import type { TipSelectionType } from "@prisma/client";

import { resolveAllocationRuleForTip } from "./allocation-routing";
import { prisma } from "./prisma";
import type { PublicTipPageData } from "./public-tip-models";

type CreateTipTransactionInput = {
  destination: PublicTipPageData;
  grossAmount: number;
  tipitFeeAmount: number;
  netAmount: number;
  guestSelectionType: TipSelectionType;
  occurredAt?: Date;
  stripeCheckoutId?: string | null;
  status?: "PENDING" | "SUCCEEDED";
};

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

function toCents(value: number) {
  return Math.round(value * 100);
}

function splitByPercentage(totalCents: number, percentages: Array<{ id: string; bps: number }>) {
  const allocations = new Map<string, number>();
  const provisional = percentages.map((line) => {
    const raw = (totalCents * line.bps) / 10_000;
    const floorAmount = Math.floor(raw);

    return {
      id: line.id,
      floorAmount,
      remainder: raw - floorAmount,
    };
  });

  provisional.forEach((entry) => {
    allocations.set(entry.id, entry.floorAmount);
  });

  let remaining = totalCents - provisional.reduce((sum, entry) => sum + entry.floorAmount, 0);

  provisional
    .slice()
    .sort((left, right) => {
      if (right.remainder !== left.remainder) {
        return right.remainder - left.remainder;
      }

      return left.id.localeCompare(right.id);
    })
    .forEach((entry) => {
      if (remaining <= 0) {
        return;
      }

      allocations.set(entry.id, (allocations.get(entry.id) ?? 0) + 1);
      remaining -= 1;
    });

  return allocations;
}

function splitEvenly(totalCents: number, count: number) {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;

  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

async function resolvePayrollPeriod(customerId: string, occurredAt: Date) {
  return prisma.payrollPeriod.findFirst({
    where: {
      customerId,
      startsAt: {
        lte: occurredAt,
      },
      endsAt: {
        gte: occurredAt,
      },
    },
    orderBy: {
      startsAt: "desc",
    },
    select: {
      id: true,
    },
  });
}

async function getActivePoolMemberIds(poolId: string, occurredAt: Date) {
  const activeMembers = await prisma.poolMember.findMany({
    where: {
      poolId,
      isActive: true,
      joinedAt: {
        lte: occurredAt,
      },
      OR: [{ leftAt: null }, { leftAt: { gte: occurredAt } }],
    },
    orderBy: {
      staffMemberId: "asc",
    },
    select: {
      staffMemberId: true,
    },
  });

  if (activeMembers.length === 0) {
    throw new Error("Pool allocation requires active members");
  }

  return activeMembers.map((member) => member.staffMemberId);
}

export async function createTipTransaction(input: CreateTipTransactionInput) {
  const occurredAt = input.occurredAt ?? new Date();
  const payrollPeriod = await resolvePayrollPeriod(input.destination.customerId, occurredAt);

  return prisma.tipTransaction.create({
    data: {
      customerId: input.destination.customerId,
      venueId: input.destination.venueId,
      payrollPeriodId: payrollPeriod?.id,
      qrCodeSlug: input.destination.slug,
      destinationType: input.destination.destinationType,
      destinationEmployeeId: input.destination.destinationEmployeeId,
      destinationPoolId: input.destination.destinationPoolId,
      destinationVenueId: input.destination.destinationVenueId ?? input.destination.venueId,
      destinationServiceAreaId: input.destination.destinationServiceAreaId,
      guestSelectionType: input.guestSelectionType,
      currency: input.destination.currency,
      grossAmount: toMoney(input.grossAmount),
      tipitFeeAmount: toMoney(input.tipitFeeAmount),
      netAmount: toMoney(input.netAmount),
      status: input.status ?? "PENDING",
      occurredAt,
      stripeCheckoutId: input.stripeCheckoutId ?? undefined,
    },
    select: {
      id: true,
      payrollPeriodId: true,
      occurredAt: true,
      status: true,
      stripeCheckoutId: true,
    },
  });
}

export async function finalizeTipTransaction(tipTransactionId: string, stripeCheckoutId?: string) {
  const tip = await prisma.tipTransaction.findUnique({
    where: { id: tipTransactionId },
    include: {
      destinationServiceArea: {
        select: {
          id: true,
          departmentId: true,
        },
      },
    },
  });

  if (!tip) {
    throw new Error("Tip transaction not found");
  }

  const resultRows: Array<{
    customerId: string;
    venueId: string;
    payrollPeriodId: string | null;
    tipTransactionId: string;
    employeeId: string;
    poolId: string | null;
    grossAmount: number;
    netAmount: number;
  }> = [];

  if (tip.destinationType === "EMPLOYEE" && tip.destinationEmployeeId) {
    resultRows.push({
      customerId: tip.customerId,
      venueId: tip.venueId,
      payrollPeriodId: tip.payrollPeriodId ?? null,
      tipTransactionId: tip.id,
      employeeId: tip.destinationEmployeeId!,
      poolId: null,
      grossAmount: toMoney(Number(tip.grossAmount)),
      netAmount: toMoney(Number(tip.netAmount)),
    });
  } else if (
    (tip.destinationType === "POOL" && tip.destinationPoolId) ||
    (tip.destinationType === "SERVICE_AREA" && tip.destinationPoolId)
  ) {
    const activeMemberIds = await getActivePoolMemberIds(tip.destinationPoolId, tip.occurredAt);
    const grossMemberSplits = splitEvenly(toCents(Number(tip.grossAmount)), activeMemberIds.length);
    const netMemberSplits = splitEvenly(toCents(Number(tip.netAmount)), activeMemberIds.length);

    activeMemberIds.forEach((employeeId, index) => {
      resultRows.push({
        customerId: tip.customerId,
        venueId: tip.venueId,
        payrollPeriodId: tip.payrollPeriodId ?? null,
        tipTransactionId: tip.id,
        employeeId,
        poolId: tip.destinationPoolId,
        grossAmount: toMoney(grossMemberSplits[index] / 100),
        netAmount: toMoney(netMemberSplits[index] / 100),
      });
    });
  } else {
    const rule = await resolveAllocationRuleForTip({
      venueId: tip.venueId,
      departmentId: tip.destinationServiceArea?.departmentId,
      serviceAreaId: tip.destinationServiceAreaId,
      occurredAt: tip.occurredAt,
      guestSelectionType: tip.guestSelectionType ?? "TEAM",
    });
    if (!rule || rule.lines.length === 0) {
      throw new Error("No active allocation rule available for this tip");
    }

    const percentageTotal = rule.lines.reduce((sum, line) => sum + line.percentageBps, 0);
    if (percentageTotal !== 10_000) {
      throw new Error("Allocation rule percentages must total 10000 basis points");
    }

    const lineGrossAllocations = splitByPercentage(
      toCents(Number(tip.grossAmount)),
      rule.lines.map((line) => ({ id: line.id, bps: line.percentageBps })),
    );
    const lineNetAllocations = splitByPercentage(
      toCents(Number(tip.netAmount)),
      rule.lines.map((line) => ({ id: line.id, bps: line.percentageBps })),
    );

    for (const line of rule.lines) {
      const grossLineCents = lineGrossAllocations.get(line.id) ?? 0;
      const netLineCents = lineNetAllocations.get(line.id) ?? 0;

      if (line.recipientType === "SELECTED_STAFF") {
        if (!tip.destinationEmployeeId) {
          throw new Error("Selected-staff allocation requires a selected employee");
        }

        resultRows.push({
          customerId: tip.customerId,
          venueId: tip.venueId,
          payrollPeriodId: tip.payrollPeriodId ?? null,
          tipTransactionId: tip.id,
          employeeId: tip.destinationEmployeeId,
          poolId: null,
          grossAmount: toMoney(grossLineCents / 100),
          netAmount: toMoney(netLineCents / 100),
        });
        continue;
      }

      if (line.recipientType === "STAFF" && line.staffMemberId) {
        resultRows.push({
          customerId: tip.customerId,
          venueId: tip.venueId,
          payrollPeriodId: tip.payrollPeriodId ?? null,
          tipTransactionId: tip.id,
          employeeId: line.staffMemberId,
          poolId: null,
          grossAmount: toMoney(grossLineCents / 100),
          netAmount: toMoney(netLineCents / 100),
        });
        continue;
      }

      if (line.recipientType === "POOL" && line.poolId) {
        const activeMemberIds = await getActivePoolMemberIds(line.poolId, tip.occurredAt);
        const grossMemberSplits = splitEvenly(grossLineCents, activeMemberIds.length);
        const netMemberSplits = splitEvenly(netLineCents, activeMemberIds.length);

        activeMemberIds.forEach((employeeId, index) => {
          resultRows.push({
            customerId: tip.customerId,
            venueId: tip.venueId,
            payrollPeriodId: tip.payrollPeriodId ?? null,
            tipTransactionId: tip.id,
            employeeId,
            poolId: line.poolId ?? null,
            grossAmount: toMoney(grossMemberSplits[index] / 100),
            netAmount: toMoney(netMemberSplits[index] / 100),
          });
        });
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.allocationResult.deleteMany({
      where: {
        tipTransactionId: tip.id,
      },
    });

    await tx.tipTransaction.update({
      where: { id: tip.id },
      data: {
        status: "SUCCEEDED",
        stripeCheckoutId: stripeCheckoutId ?? tip.stripeCheckoutId ?? undefined,
      },
    });

    if (resultRows.length > 0) {
      await tx.allocationResult.createMany({
        data: resultRows,
      });
    }
  });

  return prisma.tipTransaction.findUniqueOrThrow({
    where: { id: tip.id },
  });
}
