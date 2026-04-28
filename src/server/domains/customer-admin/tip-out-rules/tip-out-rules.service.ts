import type { PrismaClient, TipOutRuleScope } from "@prisma/client";

import { PoolDistributionService } from "../../../../services/pool-distribution-service";
import { prisma } from "../../../../lib/prisma";
import type { AuthenticatedUser } from "../../../shared/auth/types";
import { NotFoundError, ValidationAppError } from "../../../shared/errors/app-error";

type TipOutRuleInput = {
  scope: TipOutRuleScope;
  venueId?: string;
  departmentId?: string;
  targetPoolId: string;
  name: string;
  description?: string;
  rateDecimal: number;
  capAtAvailableTipBalance?: boolean;
  isActive?: boolean;
  effectiveFrom?: Date;
  effectiveTo?: Date;
};

type TipOutRuleFilters = {
  venueId?: string;
  departmentId?: string;
};

type TipOutCalculationInput = {
  totalSales: number;
  discounts?: number;
  availableTipBalance: number;
  rateDecimal: number;
  capAtAvailableTipBalance?: boolean;
};

type TipOutPreviewInput = {
  tipOutRuleId?: string;
  venueId: string;
  departmentId?: string;
  staffMemberId: string;
  importedServiceChargeId?: string;
  businessDate?: Date;
  totalSales?: number;
  discounts?: number;
  availableTipBalance?: number;
};

type TipOutPostingInput = TipOutPreviewInput;

type PayrollDistributionPreviewInput = {
  poolId: string;
  payrollPeriodId: string;
};

type ManualHoursEntryInput = {
  staffMemberId: string;
  hoursWorked: number;
};

type SaveManualHoursInput = PayrollDistributionPreviewInput & {
  entries: ManualHoursEntryInput[];
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function roundRate(value: number) {
  return Number(value.toFixed(6));
}

function assertFiniteMoney(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationAppError(`${label} must be a valid positive amount or zero`);
  }
}

function toRatePercentage(rateDecimal: number) {
  return Number((rateDecimal * 100).toFixed(3));
}

function toRatePercentageLabel(rateDecimal: number) {
  return `${toRatePercentage(rateDecimal)}%`;
}

function scopePriority(scope: TipOutRuleScope) {
  switch (scope) {
    case "DEPARTMENT":
      return 3;
    case "VENUE":
      return 2;
    case "CUSTOMER":
      return 1;
  }
}

export function calculateTipOut(input: TipOutCalculationInput) {
  assertFiniteMoney(input.totalSales, "Total sales");
  assertFiniteMoney(input.discounts ?? 0, "Discounts");
  assertFiniteMoney(input.availableTipBalance, "Available tip balance");

  if (!Number.isFinite(input.rateDecimal) || input.rateDecimal < 0 || input.rateDecimal > 1) {
    throw new ValidationAppError("Tip-out rate must be stored as a decimal fraction between 0 and 1");
  }

  const discounts = roundMoney(input.discounts ?? 0);
  if (discounts > input.totalSales) {
    throw new ValidationAppError("Discounts cannot exceed total sales");
  }

  const totalSales = roundMoney(input.totalSales);
  const availableTipBalance = roundMoney(input.availableTipBalance);
  const netSales = roundMoney(totalSales - discounts);
  const requestedTipOutAmount = roundMoney(netSales * input.rateDecimal);
  const capAtAvailableTipBalance = input.capAtAvailableTipBalance ?? true;

  if (!capAtAvailableTipBalance && requestedTipOutAmount > availableTipBalance) {
    throw new ValidationAppError("Tip-out cannot exceed the available eligible tip balance");
  }

  const tipOutAmount = capAtAvailableTipBalance
    ? roundMoney(Math.min(requestedTipOutAmount, availableTipBalance))
    : requestedTipOutAmount;

  return {
    totalSales,
    discounts,
    netSales,
    availableTipBalance,
    rateDecimal: roundRate(input.rateDecimal),
    ratePercentage: toRatePercentage(input.rateDecimal),
    requestedTipOutAmount,
    tipOutAmount,
    remainingTipBalanceAmount: roundMoney(availableTipBalance - tipOutAmount),
    wasCapped: tipOutAmount < requestedTipOutAmount,
    capAtAvailableTipBalance,
  };
}

export class TipOutRulesService {
  private readonly distributionService = new PoolDistributionService();

  constructor(
    private readonly db: Pick<
      PrismaClient,
      | "tipOutRule"
      | "tipOutPosting"
      | "venue"
      | "department"
      | "pool"
      | "staffMember"
      | "importedServiceCharge"
      | "payrollPeriod"
      | "importedHoursWorked"
      | "poolMember"
      | "auditLog"
      | "$transaction"
    > = prisma,
  ) {}

  async list(customerId: string, filters?: TipOutRuleFilters) {
    const rules = await this.db.tipOutRule.findMany({
      where: {
        customerId,
        ...(filters?.venueId ? { OR: [{ venueId: filters.venueId }, { scope: "CUSTOMER" }] } : {}),
        ...(filters?.departmentId
          ? { OR: [{ departmentId: filters.departmentId }, { scope: "VENUE" }, { scope: "CUSTOMER" }] }
          : {}),
      },
      orderBy: [
        { scope: "desc" },
        { venue: { name: "asc" } },
        { department: { name: "asc" } },
        { name: "asc" },
      ],
      include: {
        venue: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, revenueCentreType: true } },
        targetPool: { select: { id: true, name: true, poolType: true, venueId: true } },
      },
    });

    return rules
      .map((rule) => this.serializeRule(rule))
      .sort((left, right) => {
        const prioritySort = scopePriority(right.scope) - scopePriority(left.scope);
        if (prioritySort !== 0) {
          return prioritySort;
        }

        const venueSort = (left.venue?.name ?? "").localeCompare(right.venue?.name ?? "");
        if (venueSort !== 0) {
          return venueSort;
        }

        const departmentSort = (left.department?.name ?? "").localeCompare(right.department?.name ?? "");
        if (departmentSort !== 0) {
          return departmentSort;
        }

        return left.name.localeCompare(right.name);
      });
  }

  async create(customerId: string, actor: AuthenticatedUser, input: TipOutRuleInput) {
    const normalized = await this.assertRuleReferences(customerId, input);

    return this.db.$transaction(async (tx) => {
      const created = await tx.tipOutRule.create({
        data: {
          customerId,
          scope: normalized.scope,
          venueId: normalized.venueId,
          departmentId: normalized.departmentId,
          targetPoolId: normalized.targetPoolId,
          name: normalized.name,
          description: normalized.description,
          rateDecimal: roundRate(normalized.rateDecimal),
          capAtAvailableTipBalance: normalized.capAtAvailableTipBalance ?? true,
          isActive: normalized.isActive ?? true,
          effectiveFrom: normalized.effectiveFrom,
          effectiveTo: normalized.effectiveTo,
        },
        include: this.ruleInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          customerId,
          customerUserId: actor.customerUserId,
          venueId: created.venueId ?? undefined,
          poolId: created.targetPoolId,
          entityType: "TipOutRule",
          entityId: created.id,
          action: "tip-out-rule.created",
          summary: `Created tip-out rule ${created.name}`,
          afterData: this.toAuditSnapshot(created),
          metadata: {
            scope: created.scope,
            ratePercentage: toRatePercentage(Number(created.rateDecimal)),
          },
        },
      });

      return this.serializeRule(created);
    });
  }

  async update(customerId: string, ruleId: string, actor: AuthenticatedUser, input: Partial<TipOutRuleInput>) {
    const existing = await this.db.tipOutRule.findFirst({
      where: { id: ruleId, customerId },
      include: this.ruleInclude,
    });

    if (!existing) {
      throw new NotFoundError("Tip-out rule not found");
    }

    const merged: TipOutRuleInput = {
      scope: input.scope ?? existing.scope,
      venueId: input.venueId ?? existing.venueId ?? undefined,
      departmentId: input.departmentId ?? existing.departmentId ?? undefined,
      targetPoolId: input.targetPoolId ?? existing.targetPoolId,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description ?? undefined,
      rateDecimal: input.rateDecimal ?? Number(existing.rateDecimal),
      capAtAvailableTipBalance: input.capAtAvailableTipBalance ?? existing.capAtAvailableTipBalance,
      isActive: input.isActive ?? existing.isActive,
      effectiveFrom: input.effectiveFrom ?? existing.effectiveFrom ?? undefined,
      effectiveTo: input.effectiveTo ?? existing.effectiveTo ?? undefined,
    };

    const normalized = await this.assertRuleReferences(customerId, merged);
    const previousSnapshot = this.toAuditSnapshot(existing);

    return this.db.$transaction(async (tx) => {
      const updated = await tx.tipOutRule.update({
        where: { id: ruleId },
        data: {
          scope: normalized.scope,
          venueId: normalized.venueId,
          departmentId: normalized.departmentId,
          targetPoolId: normalized.targetPoolId,
          name: normalized.name,
          description: normalized.description,
          rateDecimal: roundRate(normalized.rateDecimal),
          capAtAvailableTipBalance: normalized.capAtAvailableTipBalance,
          isActive: normalized.isActive,
          effectiveFrom: normalized.effectiveFrom,
          effectiveTo: normalized.effectiveTo,
        },
        include: this.ruleInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          customerId,
          customerUserId: actor.customerUserId,
          venueId: updated.venueId ?? undefined,
          poolId: updated.targetPoolId,
          entityType: "TipOutRule",
          entityId: updated.id,
          action: "tip-out-rule.updated",
          summary: `Updated tip-out rule ${updated.name}`,
          beforeData: previousSnapshot,
          afterData: this.toAuditSnapshot(updated),
          metadata: {
            scope: updated.scope,
            ratePercentage: toRatePercentage(Number(updated.rateDecimal)),
          },
        },
      });

      return this.serializeRule(updated);
    });
  }

  async remove(customerId: string, ruleId: string, actor: AuthenticatedUser) {
    const rule = await this.db.tipOutRule.findFirst({
      where: { id: ruleId, customerId },
      include: {
        ...this.ruleInclude,
        _count: {
          select: {
            tipOutPostings: true,
          },
        },
      },
    });

    if (!rule) {
      throw new NotFoundError("Tip-out rule not found");
    }

    if (rule._count.tipOutPostings > 0) {
      throw new ValidationAppError(
        "This tip-out rule already has posting history. Deactivate it instead of deleting it.",
      );
    }

    await this.db.$transaction(async (tx) => {
      await tx.tipOutRule.delete({
        where: { id: ruleId },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          customerId,
          customerUserId: actor.customerUserId,
          venueId: rule.venueId ?? undefined,
          poolId: rule.targetPoolId,
          entityType: "TipOutRule",
          entityId: rule.id,
          action: "tip-out-rule.deleted",
          summary: `Deleted tip-out rule ${rule.name}`,
          beforeData: this.toAuditSnapshot(rule),
          metadata: {
            scope: rule.scope,
          },
        },
      });
    });

    return { id: ruleId, deleted: true as const };
  }

  async preview(customerId: string, input: TipOutPreviewInput) {
    const prepared = await this.preparePostingInput(customerId, input);
    const rule = await this.resolveApplicableRule(
      customerId,
      prepared.venueId,
      prepared.departmentId,
      prepared.businessDate,
      prepared.tipOutRuleId,
    );

    if (!rule) {
      throw new ValidationAppError("No active tip-out rule applies to this customer, venue, or department");
    }

    this.assertRuleMatchesPosting(rule, prepared.venueId, prepared.departmentId);

    const calculation = calculateTipOut({
      totalSales: prepared.totalSales,
      discounts: prepared.discounts,
      availableTipBalance: prepared.availableTipBalance,
      rateDecimal: Number(rule.rateDecimal),
      capAtAvailableTipBalance: rule.capAtAvailableTipBalance,
    });

    return {
      rule: this.serializeRule(rule),
      staffMemberId: prepared.staffMemberId,
      targetPool: {
        id: rule.targetPool.id,
        name: rule.targetPool.name,
        poolType: rule.targetPool.poolType,
      },
      businessDate: prepared.businessDate,
      ...calculation,
    };
  }

  async createPosting(customerId: string, actor: AuthenticatedUser, input: TipOutPostingInput) {
    const preview = await this.preview(customerId, input);

    return this.db.$transaction(async (tx) => {
      const posting = await tx.tipOutPosting.create({
        data: {
          customerId,
          venueId: preview.rule.venueId ?? input.venueId,
          departmentId: preview.rule.departmentId ?? input.departmentId,
          payrollPeriodId: await this.resolvePayrollPeriodId(customerId, preview.businessDate),
          tipOutRuleId: preview.rule.id,
          targetPoolId: preview.targetPool.id,
          staffMemberId: preview.staffMemberId,
          importedServiceChargeId: input.importedServiceChargeId,
          businessDate: preview.businessDate,
          totalSalesAmount: preview.totalSales,
          discountsAmount: preview.discounts,
          netSalesAmount: preview.netSales,
          availableTipBalanceAmount: preview.availableTipBalance,
          tipOutRateDecimal: preview.rateDecimal,
          requestedTipOutAmount: preview.requestedTipOutAmount,
          tipOutAmount: preview.tipOutAmount,
          remainingTipBalanceAmount: preview.remainingTipBalanceAmount,
          wasCapped: preview.wasCapped,
        },
        include: {
          targetPool: { select: { id: true, name: true, poolType: true } },
          staffMember: { select: { id: true, firstName: true, lastName: true, displayName: true } },
          tipOutRule: { include: this.ruleInclude },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          customerId,
          customerUserId: actor.customerUserId,
          venueId: posting.venueId,
          staffMemberId: posting.staffMemberId,
          poolId: posting.targetPoolId,
          entityType: "TipOutPosting",
          entityId: posting.id,
          action: "tip-out.posted",
          summary: `Posted ${Number(posting.tipOutAmount).toFixed(2)} into ${posting.targetPool.name}`,
          afterData: {
            totalSalesAmount: Number(posting.totalSalesAmount),
            discountsAmount: Number(posting.discountsAmount),
            netSalesAmount: Number(posting.netSalesAmount),
            tipOutAmount: Number(posting.tipOutAmount),
            remainingTipBalanceAmount: Number(posting.remainingTipBalanceAmount),
          },
          metadata: {
            ruleId: posting.tipOutRuleId,
            poolId: posting.targetPoolId,
            staffMemberId: posting.staffMemberId,
          },
        },
      });

      return {
        id: posting.id,
        businessDate: posting.businessDate,
        staffMember: {
          id: posting.staffMember.id,
          displayName:
            posting.staffMember.displayName ??
            `${posting.staffMember.firstName} ${posting.staffMember.lastName}`.trim(),
        },
        targetPool: posting.targetPool,
        rule: this.serializeRule(posting.tipOutRule),
        totalSales: Number(posting.totalSalesAmount),
        discounts: Number(posting.discountsAmount),
        netSales: Number(posting.netSalesAmount),
        availableTipBalance: Number(posting.availableTipBalanceAmount),
        rateDecimal: Number(posting.tipOutRateDecimal),
        ratePercentage: toRatePercentage(Number(posting.tipOutRateDecimal)),
        requestedTipOutAmount: Number(posting.requestedTipOutAmount),
        tipOutAmount: Number(posting.tipOutAmount),
        remainingTipBalanceAmount: Number(posting.remainingTipBalanceAmount),
        wasCapped: posting.wasCapped,
        payrollPeriodId: posting.payrollPeriodId,
      };
    });
  }

  async previewPayrollDistribution(customerId: string, input: PayrollDistributionPreviewInput) {
    return this.buildPayrollDistributionPreview(customerId, input);
  }

  async saveManualHours(customerId: string, actor: AuthenticatedUser, input: SaveManualHoursInput) {
    const { pool, payrollPeriod, memberNames } = await this.resolvePoolAndPayrollPeriod(customerId, input);
    const duplicateIds = new Set<string>();
    const inputMap = new Map<string, number>();

    for (const entry of input.entries) {
      if (duplicateIds.has(entry.staffMemberId)) {
        throw new ValidationAppError("Staff members can only appear once in manual hours entry");
      }
      duplicateIds.add(entry.staffMemberId);

      if (!memberNames.has(entry.staffMemberId)) {
        throw new ValidationAppError("Manual hours can only be saved for active members of the selected pool");
      }

      if (!Number.isFinite(entry.hoursWorked) || entry.hoursWorked < 0) {
        throw new ValidationAppError("Hours worked must be a valid positive number or zero");
      }

      inputMap.set(entry.staffMemberId, Number(entry.hoursWorked.toFixed(4)));
    }

    const allEntries = Array.from(memberNames.keys()).map((staffMemberId) => ({
      staffMemberId,
      hoursWorked: inputMap.get(staffMemberId) ?? 0,
    }));

    await this.db.$transaction(async (tx) => {
      for (const entry of allEntries) {
        await tx.importedHoursWorked.upsert({
          where: {
            integrationProvider_externalRecordRef: {
              integrationProvider: "OTHER",
              externalRecordRef: `manual-tipout-hours:${input.payrollPeriodId}:${input.poolId}:${entry.staffMemberId}`,
            },
          },
          create: {
            customerId,
            venueId: pool.venueId,
            staffMemberId: entry.staffMemberId,
            integrationProvider: "OTHER",
            externalRecordRef: `manual-tipout-hours:${input.payrollPeriodId}:${input.poolId}:${entry.staffMemberId}`,
            sourceSystemName: "Manual tip-out hours",
            status: "SUCCEEDED",
            workDate: payrollPeriod.startDate,
            hoursWorked: entry.hoursWorked,
          },
          update: {
            venueId: pool.venueId,
            workDate: payrollPeriod.startDate,
            hoursWorked: entry.hoursWorked,
            status: "SUCCEEDED",
            sourceSystemName: "Manual tip-out hours",
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          customerId,
          customerUserId: actor.customerUserId,
          venueId: pool.venueId,
          poolId: pool.id,
          entityType: "TipOutHours",
          entityId: `${input.poolId}:${input.payrollPeriodId}`,
          action: "tip-out.manual-hours.saved",
          summary: `Saved manual tip-out hours for ${pool.name}`,
          metadata: {
            payrollPeriodId: payrollPeriod.id,
            entryCount: allEntries.length,
          },
          afterData: {
            entries: allEntries,
          },
        },
      });
    });

    return this.buildPayrollDistributionPreview(customerId, input);
  }

  private readonly ruleInclude = {
    venue: { select: { id: true, name: true } },
    department: { select: { id: true, name: true, revenueCentreType: true } },
    targetPool: { select: { id: true, name: true, poolType: true, venueId: true } },
  } as const;

  private async assertRuleReferences(customerId: string, input: TipOutRuleInput) {
    if (!Number.isFinite(input.rateDecimal) || input.rateDecimal < 0 || input.rateDecimal > 1) {
      throw new ValidationAppError("Tip-out rate must be stored as a decimal fraction between 0 and 1");
    }

    if (input.scope === "CUSTOMER" && input.departmentId) {
      throw new ValidationAppError("Customer-level tip-out rules cannot target a specific department");
    }

    if (input.scope === "VENUE" && input.departmentId) {
      throw new ValidationAppError("Venue-level tip-out rules cannot target a specific department");
    }

    if (input.scope === "VENUE" && !input.venueId) {
      throw new ValidationAppError("Venue-level tip-out rules require a venue");
    }

    if (input.scope === "DEPARTMENT" && (!input.venueId || !input.departmentId)) {
      throw new ValidationAppError("Department-level tip-out rules require both a venue and department");
    }

    const [venue, department, pool] = await Promise.all([
      input.venueId
        ? this.db.venue.findFirst({
            where: { id: input.venueId, customerId },
            select: { id: true },
          })
        : Promise.resolve(null),
      input.departmentId
        ? this.db.department.findFirst({
            where: { id: input.departmentId, customerId },
            select: { id: true, venueId: true },
          })
        : Promise.resolve(null),
      this.db.pool.findFirst({
        where: { id: input.targetPoolId, customerId },
        select: { id: true, venueId: true },
      }),
    ]);

    if (input.venueId && !venue) {
      throw new NotFoundError("Venue not found");
    }

    if (input.departmentId && !department) {
      throw new NotFoundError("Department not found");
    }

    if (department && input.venueId && department.venueId !== input.venueId) {
      throw new ValidationAppError("Department tip-out rules must belong to the selected venue");
    }

    if (!pool) {
      throw new NotFoundError("Target pool not found");
    }

    if (input.venueId && pool.venueId !== input.venueId) {
      throw new ValidationAppError("Target pool must belong to the same venue as the tip-out rule");
    }

    return {
      ...input,
      venueId: input.scope === "CUSTOMER" ? undefined : input.venueId,
      departmentId: input.scope === "DEPARTMENT" ? input.departmentId : undefined,
    };
  }

  private async preparePostingInput(customerId: string, input: TipOutPreviewInput) {
    const imported = input.importedServiceChargeId
      ? await this.db.importedServiceCharge.findFirst({
          where: {
            id: input.importedServiceChargeId,
            customerId,
          },
          select: {
            id: true,
            venueId: true,
            departmentId: true,
            staffMemberId: true,
            businessDate: true,
            grossSalesAmount: true,
            discountsAmount: true,
            cardTipAmount: true,
          },
        })
      : null;

    if (input.importedServiceChargeId && !imported) {
      throw new NotFoundError("Imported service charge record not found");
    }

    const venueId = imported?.venueId ?? input.venueId;
    const departmentId = imported?.departmentId ?? input.departmentId;
    const staffMemberId = imported?.staffMemberId ?? input.staffMemberId;
    const businessDate = input.businessDate ?? imported?.businessDate ?? new Date();
    const totalSales = input.totalSales ?? Number(imported?.grossSalesAmount ?? 0);
    const discounts = input.discounts ?? Number(imported?.discountsAmount ?? 0);
    const availableTipBalance = input.availableTipBalance ?? Number(imported?.cardTipAmount ?? 0);

    if (!staffMemberId) {
      throw new ValidationAppError("A staff member is required to calculate a tip-out posting");
    }

    const [venue, department, staffMember] = await Promise.all([
      this.db.venue.findFirst({
        where: { id: venueId, customerId },
        select: { id: true },
      }),
      departmentId
        ? this.db.department.findFirst({
            where: { id: departmentId, customerId },
            select: { id: true, venueId: true },
          })
        : Promise.resolve(null),
      this.db.staffMember.findFirst({
        where: { id: staffMemberId, customerId },
        select: { id: true, venueId: true },
      }),
    ]);

    if (!venue) {
      throw new NotFoundError("Venue not found");
    }

    if (departmentId && !department) {
      throw new NotFoundError("Department not found");
    }

    if (department && department.venueId !== venueId) {
      throw new ValidationAppError("Department must belong to the selected venue");
    }

    if (!staffMember) {
      throw new NotFoundError("Staff member not found");
    }

    if (staffMember.venueId !== venueId) {
      throw new ValidationAppError("Staff member must belong to the selected venue");
    }

    return {
      tipOutRuleId: input.tipOutRuleId,
      importedServiceChargeId: input.importedServiceChargeId,
      venueId,
      departmentId,
      staffMemberId,
      businessDate,
      totalSales,
      discounts,
      availableTipBalance,
    };
  }

  private async resolveApplicableRule(
    customerId: string,
    venueId: string,
    departmentId: string | undefined,
    businessDate: Date,
    ruleId?: string,
  ) {
    if (ruleId) {
      return this.db.tipOutRule.findFirst({
        where: {
          id: ruleId,
          customerId,
          isActive: true,
        },
        include: this.ruleInclude,
      });
    }

    const rules = await this.db.tipOutRule.findMany({
      where: {
        customerId,
        isActive: true,
        AND: [
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: businessDate } }] },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: businessDate } }] },
          { OR: [{ venueId: null }, { venueId }] },
        ],
      },
      include: this.ruleInclude,
    });

    const matches = rules
      .filter((rule) => {
        if (rule.scope === "DEPARTMENT") {
          return !!departmentId && rule.departmentId === departmentId;
        }

        if (rule.scope === "VENUE") {
          return rule.venueId === venueId;
        }

        return true;
      })
      .sort((left, right) => {
        const scopeSort = scopePriority(right.scope) - scopePriority(left.scope);
        if (scopeSort !== 0) {
          return scopeSort;
        }

        return right.createdAt.getTime() - left.createdAt.getTime();
      });

    return matches[0] ?? null;
  }

  private assertRuleMatchesPosting(
    rule: {
      scope: TipOutRuleScope;
      venueId: string | null;
      departmentId: string | null;
      targetPool: { venueId: string };
    },
    postingVenueId: string,
    postingDepartmentId?: string,
  ) {
    if (rule.scope === "VENUE" && rule.venueId !== postingVenueId) {
      throw new ValidationAppError("Tip-out rule must belong to the same venue as the posting");
    }

    if (rule.scope === "DEPARTMENT" && rule.departmentId !== postingDepartmentId) {
      throw new ValidationAppError("Tip-out rule department must match the posting department");
    }

    if (rule.targetPool.venueId !== postingVenueId) {
      throw new ValidationAppError("Tip-out target pool must belong to the same venue as the posting");
    }
  }

  private async resolvePayrollPeriodId(customerId: string, businessDate: Date) {
    const period = await this.db.payrollPeriod.findFirst({
      where: {
        customerId,
        startDate: { lte: businessDate },
        endDate: { gte: businessDate },
      },
      select: { id: true },
      orderBy: { startDate: "desc" },
    });

    return period?.id ?? null;
  }

  private async resolvePoolAndPayrollPeriod(customerId: string, input: PayrollDistributionPreviewInput) {
    const [pool, payrollPeriod] = await Promise.all([
      this.db.pool.findFirst({
        where: { id: input.poolId, customerId },
        select: { id: true, name: true, venueId: true, poolType: true },
      }),
      this.db.payrollPeriod.findFirst({
        where: { id: input.payrollPeriodId, customerId },
        select: { id: true, label: true, startDate: true, endDate: true },
      }),
    ]);

    if (!pool) {
      throw new NotFoundError("Pool not found");
    }

    if (!payrollPeriod) {
      throw new NotFoundError("Payroll period not found");
    }

    const members = await this.db.poolMember.findMany({
      where: {
        poolId: pool.id,
        joinedAt: { lte: payrollPeriod.endDate },
        OR: [{ leftAt: null }, { leftAt: { gte: payrollPeriod.startDate } }],
      },
      include: {
        staffMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    });

    const memberNames = new Map(
      members.map((member) => [
        member.staffMember.id,
        member.staffMember.displayName ??
          `${member.staffMember.firstName} ${member.staffMember.lastName}`.trim(),
      ]),
    );

    return { pool, payrollPeriod, memberNames };
  }

  private async buildPayrollDistributionPreview(customerId: string, input: PayrollDistributionPreviewInput) {
    const { pool, payrollPeriod, memberNames } = await this.resolvePoolAndPayrollPeriod(customerId, input);

    const [postings, importedHours] = await Promise.all([
      this.db.tipOutPosting.findMany({
        where: {
          customerId,
          targetPoolId: pool.id,
          payrollPeriodId: payrollPeriod.id,
        },
        select: {
          tipOutAmount: true,
        },
      }),
      this.db.importedHoursWorked.findMany({
        where: {
          customerId,
          venueId: pool.venueId,
          workDate: {
            gte: payrollPeriod.startDate,
            lte: payrollPeriod.endDate,
          },
          staffMemberId: { in: Array.from(memberNames.keys()) },
        },
        select: {
          staffMemberId: true,
          hoursWorked: true,
          sourceSystemName: true,
        },
      }),
    ]);

    const manualHoursRows = importedHours.filter(
      (row) =>
        typeof row.staffMemberId === "string" &&
        memberNames.has(row.staffMemberId) &&
        row.sourceSystemName === "Manual tip-out hours",
    );

    const effectiveHours = manualHoursRows.length > 0 ? manualHoursRows : importedHours;

    const hoursByStaffId = new Map<string, number>();
    for (const row of effectiveHours) {
      if (!row.staffMemberId || !memberNames.has(row.staffMemberId)) {
        continue;
      }

      hoursByStaffId.set(
        row.staffMemberId,
        Number(((hoursByStaffId.get(row.staffMemberId) ?? 0) + Number(row.hoursWorked)).toFixed(4)),
      );
    }

    const distribution = this.distributionService.calculateDistribution({
      poolTotal: Number(postings.reduce((sum, posting) => sum + Number(posting.tipOutAmount), 0).toFixed(2)),
      staff: Array.from(memberNames.entries()).map(([staffMemberId, employeeName]) => ({
        staffMemberId,
        employeeName,
        hoursWorked: hoursByStaffId.get(staffMemberId) ?? 0,
      })),
    });

    return {
      pool: {
        id: pool.id,
        name: pool.name,
        poolType: pool.poolType,
      },
      payrollPeriod: {
        id: payrollPeriod.id,
        label: payrollPeriod.label,
        startDate: payrollPeriod.startDate,
        endDate: payrollPeriod.endDate,
      },
      poolTotal: distribution.poolTotal,
      totalHoursWorked: distribution.totalHoursWorked,
      perHourRate: distribution.perHourRate,
      hoursEntries: distribution.allocations.map((allocation) => ({
        staffMemberId: allocation.staffMemberId,
        employeeName: allocation.employeeName,
        hoursWorked: allocation.hoursWorked,
      })),
      allocations: distribution.allocations,
    };
  }

  private toAuditSnapshot(rule: {
    id: string;
    scope: TipOutRuleScope;
    venueId: string | null;
    departmentId: string | null;
    targetPoolId: string;
    name: string;
    description: string | null;
    rateDecimal: unknown;
    capAtAvailableTipBalance: boolean;
    isActive: boolean;
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
  }) {
    return {
      id: rule.id,
      scope: rule.scope,
      venueId: rule.venueId,
      departmentId: rule.departmentId,
      targetPoolId: rule.targetPoolId,
      name: rule.name,
      description: rule.description,
      rateDecimal: Number(rule.rateDecimal),
      capAtAvailableTipBalance: rule.capAtAvailableTipBalance,
      isActive: rule.isActive,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
    };
  }

  private serializeRule(rule: {
    id: string;
    customerId: string;
    scope: TipOutRuleScope;
    venueId: string | null;
    departmentId: string | null;
    targetPoolId: string;
    name: string;
    description: string | null;
    rateDecimal: unknown;
    capAtAvailableTipBalance: boolean;
    isActive: boolean;
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
    createdAt: Date;
    updatedAt: Date;
    venue?: { id: string; name: string } | null;
    department?: { id: string; name: string; revenueCentreType: string } | null;
    targetPool?: { id: string; name: string; poolType: string } | null;
  }) {
    const rateDecimal = Number(rule.rateDecimal);
    return {
      id: rule.id,
      customerId: rule.customerId,
      scope: rule.scope,
      venueId: rule.venueId,
      departmentId: rule.departmentId,
      targetPoolId: rule.targetPoolId,
      name: rule.name,
      description: rule.description,
      rateDecimal,
      ratePercentage: toRatePercentage(rateDecimal),
      ratePercentageLabel: toRatePercentageLabel(rateDecimal),
      capAtAvailableTipBalance: rule.capAtAvailableTipBalance,
      isActive: rule.isActive,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      venue: rule.venue ?? undefined,
      department: rule.department ?? undefined,
      targetPool: rule.targetPool ?? undefined,
    };
  }
}
