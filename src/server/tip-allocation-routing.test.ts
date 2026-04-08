import assert from "node:assert/strict";
import test from "node:test";

import { createTipTransaction, finalizeTipTransaction } from "../lib/tip-settlement";
import { prisma } from "../lib/prisma";
import { resolveTipSelectionFromPublicFlow } from "../lib/public-tip-selection";
import type { PublicTipPageData } from "../lib/public-tip-models";

async function getBreakfastContext() {
  const serviceArea = await prisma.serviceArea.findFirstOrThrow({
    where: { slug: "breakfast-table-card" },
    include: {
      customer: true,
      venue: true,
      department: true,
    },
  });
  const [maya, tom, aisha, floorPool] = await Promise.all([
    prisma.staffMember.findFirstOrThrow({
      where: { venueId: serviceArea.venueId, displayName: "Maya" },
      select: { id: true, displayName: true, firstName: true, lastName: true },
    }),
    prisma.staffMember.findFirstOrThrow({
      where: { venueId: serviceArea.venueId, displayName: "Tom" },
      select: { id: true, displayName: true, firstName: true, lastName: true },
    }),
    prisma.staffMember.findFirstOrThrow({
      where: { venueId: serviceArea.venueId, displayName: "Aisha" },
      select: { id: true, displayName: true, firstName: true, lastName: true },
    }),
    prisma.pool.findFirstOrThrow({
      where: { venueId: serviceArea.venueId, slug: "floor-team-pool" },
      select: { id: true },
    }),
  ]);

  const destination: PublicTipPageData = {
    qrCodeId: `service-area-${serviceArea.id}`,
    slug: "breakfast-table-card",
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
    venueBrandName: serviceArea.customer.name,
    venueLocation: serviceArea.venue.city ?? serviceArea.venue.name,
    brandBackgroundColor: serviceArea.venue.brandBackgroundColor,
    brandTextColor: serviceArea.venue.brandTextColor,
    brandButtonColor: serviceArea.venue.brandButtonColor,
    brandButtonTextColor: serviceArea.venue.brandButtonTextColor,
    brandLogoImageUrl: serviceArea.venue.brandLogoImageUrl,
    serviceAreaJourney: {
      serviceAreaId: serviceArea.id,
      serviceAreaName: serviceArea.name,
      departmentName: serviceArea.department.name,
      tippingMode: "TEAM_OR_INDIVIDUAL",
      displayMode: serviceArea.displayMode,
      showTeamOption: true,
      selectionUi: "LIST",
      individualTippingUnavailable: false,
      individualTippingMessage: null,
      activeShiftStaff: [maya, tom].map((staffMember) => ({
        id: staffMember.id,
        displayName:
          staffMember.displayName ?? `${staffMember.firstName} ${staffMember.lastName}`,
        sortOrder:
          staffMember.displayName === "Maya" ? 0 : 1,
      })),
    },
  };

  return {
    serviceArea,
    destination,
    maya,
    tom,
    aisha,
    floorPool,
  };
}

test("team service-area tips use the scoped team allocation rule", async () => {
  const { serviceArea, destination, tom } = await getBreakfastContext();

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
            staffMemberId: tom.id,
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
    assert.equal(allocations[0].employeeId, tom.id);
    assert.equal(Number(allocations[0].netAmount), 28.5);
  } finally {
    await prisma.allocationRule.delete({ where: { id: teamRule.id } });
  }
});

test("individual service-area tips use the scoped individual allocation rule and store the guest choice", async () => {
  const { serviceArea, destination, maya, tom, aisha, floorPool } = await getBreakfastContext();

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
            poolId: floorPool.id,
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
      selectedStaffMemberId: maya.id,
    });

    const tip = await createTipTransaction({
      destination: selection.resolvedDestination,
      guestSelectionType: selection.guestSelectionType,
      grossAmount: 30,
      tipitFeeAmount: 1.5,
      netAmount: 28.5,
      occurredAt: new Date("2026-04-02T08:45:00.000Z"),
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

    assert.ok((netByEmployee.get(maya.id) ?? 0) > (netByEmployee.get(tom.id) ?? 0));
    assert.equal(netByEmployee.get(tom.id), netByEmployee.get(aisha.id));
  } finally {
    await prisma.allocationRule.delete({ where: { id: individualRule.id } });
  }
});
