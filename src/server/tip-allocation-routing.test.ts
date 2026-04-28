import assert from "node:assert/strict";
import test from "node:test";

import { createTipTransaction, finalizeTipTransaction } from "../lib/tip-settlement";
import { prisma } from "../lib/prisma";
import { resolveTipSelectionFromPublicFlow } from "../lib/public-tip-selection";
import type { PublicTipPageData } from "../lib/public-tip-models";

async function getBreakfastContext() {
  const serviceArea = await prisma.serviceArea.findFirstOrThrow({
    where: { slug: "ssn-breakfast-table-card-a" },
    include: {
      customer: true,
      venue: true,
      department: {
        include: {
          outletBrand: true,
        },
      },
    },
  });
  const [emma, maria, josh, breakfastTeamPool] = await Promise.all([
    prisma.staffMember.findFirstOrThrow({
      where: { venueId: serviceArea.venueId, displayName: "Emma" },
      select: { id: true, displayName: true, firstName: true, lastName: true },
    }),
    prisma.staffMember.findFirstOrThrow({
      where: { venueId: serviceArea.venueId, displayName: "Maria" },
      select: { id: true, displayName: true, firstName: true, lastName: true },
    }),
    prisma.staffMember.findFirstOrThrow({
      where: { venueId: serviceArea.venueId, displayName: "Josh" },
      select: { id: true, displayName: true, firstName: true, lastName: true },
    }),
    prisma.pool.findFirstOrThrow({
      where: { venueId: serviceArea.venueId, slug: "breakfast-team-pool" },
      select: { id: true },
    }),
  ]);

  const destination: PublicTipPageData = {
    qrCodeId: `service-area-${serviceArea.id}`,
    slug: "ssn-breakfast-table-card-a",
    label: "Tip the Breakfast team",
    destinationType: "SERVICE_AREA",
    destinationEmployeeId: null,
    destinationPoolId: null,
    destinationVenueId: serviceArea.venueId,
    destinationServiceAreaId: serviceArea.id,
    customerId: serviceArea.customerId,
    venueId: serviceArea.venueId,
    customerName: serviceArea.customer.name,
    venueName: serviceArea.venue.name,
    venueSlug: serviceArea.venue.slug,
    currency: serviceArea.customer.currency,
    heading: "Tip the Breakfast Team",
    subheading: "Support breakfast service.",
    targetName: "Breakfast team",
    outletBrandId: serviceArea.department.outletBrand?.id ?? null,
    brandDisplayName: serviceArea.department.outletBrand?.displayName ?? serviceArea.customer.name,
    venueBrandName: serviceArea.department.outletBrand?.displayName ?? serviceArea.customer.name,
    venueLocation: serviceArea.venue.city ?? serviceArea.venue.name,
    brandBackgroundColor: serviceArea.venue.brandBackgroundColor,
    brandTextColor: serviceArea.venue.brandTextColor,
    brandButtonColor: serviceArea.venue.brandButtonColor,
    brandButtonTextColor: serviceArea.venue.brandButtonTextColor,
    brandLogoImageUrl: serviceArea.department.outletBrand?.logoUrl ?? serviceArea.venue.brandLogoImageUrl,
    serviceAreaJourney: {
      serviceAreaId: serviceArea.id,
      serviceAreaName: serviceArea.name,
      departmentName: serviceArea.department.name,
      revenueCentreType: serviceArea.department.revenueCentreType,
      tippingMode: "TEAM_OR_INDIVIDUAL",
      displayMode: serviceArea.displayMode,
      showTeamOption: true,
      selectionUi: "LIST",
      individualTippingUnavailable: false,
      individualTippingMessage: null,
      activeShiftStaff: [emma, maria].map((staffMember) => ({
        id: staffMember.id,
        displayName:
          staffMember.displayName ?? `${staffMember.firstName} ${staffMember.lastName}`,
        sortOrder:
          staffMember.displayName === "Emma" ? 0 : 1,
      })),
    },
  };

  return {
    serviceArea,
    destination,
    emma,
    maria,
    josh,
    breakfastTeamPool,
  };
}

test("team service-area tips use the scoped team allocation rule", async () => {
  const { serviceArea, destination, maria } = await getBreakfastContext();

  const teamRule = await prisma.allocationRule.create({
    data: {
      venueId: serviceArea.venueId,
      departmentId: serviceArea.departmentId,
      serviceAreaId: serviceArea.id,
      scope: "SERVICE_AREA",
      selectionType: "TEAM",
      name: `Breakfast team split ${Date.now()}`,
      priority: 1,
      isActive: true,
      lines: {
        create: [
          {
            recipientType: "STAFF",
            staffMemberId: maria.id,
            percentageBps: 10_000,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  try {
    const selection = resolveTipSelectionFromPublicFlow({
      destination,
      selectedRecipientMode: "TEAM",
    });

    const tip = await createTipTransaction({
      destination: selection.resolvedDestination,
      guestSelectionType: selection.guestSelectionType,
      grossAmount: 30,
      tipitFeeAmount: 1.5,
      netAmount: 28.5,
      occurredAt: new Date("2026-04-02T08:30:00.000Z"),
    });

    await finalizeTipTransaction(tip.id);

    const allocations = await prisma.allocationResult.findMany({
      where: { tipTransactionId: tip.id },
      orderBy: { employeeId: "asc" },
    });

    assert.equal(allocations.length, 1);
    assert.equal(allocations[0].employeeId, maria.id);
    assert.equal(Number(allocations[0].netAmount), 28.5);
  } finally {
    await prisma.allocationRule.delete({ where: { id: teamRule.id } });
  }
});

test("individual service-area tips use the scoped individual allocation rule and store the guest choice", async () => {
  const { serviceArea, destination, emma, maria, breakfastTeamPool } = await getBreakfastContext();

  const individualRule = await prisma.allocationRule.create({
    data: {
      venueId: serviceArea.venueId,
      departmentId: serviceArea.departmentId,
      serviceAreaId: serviceArea.id,
      scope: "SERVICE_AREA",
      selectionType: "INDIVIDUAL",
      name: `Breakfast individual split ${Date.now()}`,
      priority: 1,
      isActive: true,
      lines: {
        create: [
          {
            recipientType: "SELECTED_STAFF",
            percentageBps: 8000,
            sortOrder: 1,
          },
          {
            recipientType: "POOL",
            poolId: breakfastTeamPool.id,
            percentageBps: 2000,
            sortOrder: 2,
          },
        ],
      },
    },
  });

  try {
    const selection = resolveTipSelectionFromPublicFlow({
      destination,
      selectedRecipientMode: "INDIVIDUAL",
      selectedStaffMemberId: emma.id,
    });

    const tip = await createTipTransaction({
      destination: selection.resolvedDestination,
      guestSelectionType: selection.guestSelectionType,
      grossAmount: 30,
      tipitFeeAmount: 1.5,
      netAmount: 28.5,
      occurredAt: new Date(),
    });

    const finalizedTip = await finalizeTipTransaction(tip.id);
    assert.equal(finalizedTip.guestSelectionType, "INDIVIDUAL");

    const allocations = await prisma.allocationResult.findMany({
      where: { tipTransactionId: tip.id },
      orderBy: [{ employeeId: "asc" }, { grossAmount: "desc" }],
    });

    const netByEmployee = new Map<string, number>();
    for (const allocation of allocations) {
      netByEmployee.set(
        allocation.employeeId,
        (netByEmployee.get(allocation.employeeId) ?? 0) + Number(allocation.netAmount),
      );
    }

    assert.ok((netByEmployee.get(emma.id) ?? 0) > 0);
    assert.ok((netByEmployee.get(emma.id) ?? 0) > (netByEmployee.get(maria.id) ?? 0));
  } finally {
    await prisma.allocationRule.delete({ where: { id: individualRule.id } });
  }
});

test("service-area allocation can target a second pool in the same department context", async () => {
  const { serviceArea, destination, emma, josh } = await getBreakfastContext();

  const bohPool = await prisma.pool.create({
    data: {
      customerId: serviceArea.customerId,
      venueId: serviceArea.venueId,
      name: `Breakfast BOH Pool ${Date.now()}`,
      slug: `breakfast-boh-pool-${Date.now()}`,
      description: "Temporary BOH pool for allocation routing coverage.",
      poolType: "BOH",
      members: {
        create: [
          { staffMemberId: emma.id, joinedAt: new Date("2026-03-01T00:00:00.000Z") },
          { staffMemberId: josh.id, joinedAt: new Date("2026-03-01T00:00:00.000Z") },
        ],
      },
    },
    select: { id: true },
  });

  const teamRule = await prisma.allocationRule.create({
    data: {
      venueId: serviceArea.venueId,
      departmentId: serviceArea.departmentId,
      serviceAreaId: serviceArea.id,
      scope: "SERVICE_AREA",
      selectionType: "TEAM",
      name: `Breakfast BOH split ${Date.now()}`,
      priority: 0,
      isActive: true,
      lines: {
        create: [
          {
            recipientType: "POOL",
            poolId: bohPool.id,
            percentageBps: 10_000,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  try {
    const selection = resolveTipSelectionFromPublicFlow({
      destination,
      selectedRecipientMode: "TEAM",
    });

    const tip = await createTipTransaction({
      destination: selection.resolvedDestination,
      guestSelectionType: selection.guestSelectionType,
      grossAmount: 40,
      tipitFeeAmount: 2,
      netAmount: 38,
      occurredAt: new Date("2026-04-02T09:15:00.000Z"),
    });

    await finalizeTipTransaction(tip.id);

    const allocations = await prisma.allocationResult.findMany({
      where: { tipTransactionId: tip.id },
      orderBy: { employeeId: "asc" },
      select: {
        employeeId: true,
        poolId: true,
        netAmount: true,
      },
    });

    assert.equal(allocations.length, 2);
    assert.deepEqual(
      allocations.map((allocation) => allocation.employeeId).sort(),
      [emma.id, josh.id].sort(),
    );
    assert.ok(allocations.every((allocation) => allocation.poolId === bohPool.id));
    assert.equal(
      Number(allocations.reduce((sum, allocation) => sum + Number(allocation.netAmount), 0).toFixed(2)),
      38,
    );
  } finally {
    await prisma.allocationRule.delete({ where: { id: teamRule.id } });
    await prisma.pool.delete({ where: { id: bohPool.id } });
  }
});
