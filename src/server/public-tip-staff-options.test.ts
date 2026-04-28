import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "../app/api/tip/[slug]/staff-options/route";
import { prisma } from "../lib/prisma";

test("public tip staff options endpoint returns dropdown-friendly filtered shift staff", async () => {
  const now = new Date();
  const activeShiftStart = new Date(now.getTime() - 60 * 60 * 1000);
  const activeShiftEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const breakfastArea = await prisma.serviceArea.findFirstOrThrow({
    where: { slug: "ssn-breakfast-table-card-a" },
    include: { department: true },
  });
  const departmentSetting = await prisma.customerDepartmentTippingSetting.findUniqueOrThrow({
    where: {
      customerId_revenueCentreType: {
        customerId: breakfastArea.customerId,
        revenueCentreType: breakfastArea.department.revenueCentreType,
      },
    },
  });
  const originalServiceArea = await prisma.serviceArea.findUniqueOrThrow({
    where: { id: breakfastArea.id },
  });
  const breakfastShift = await prisma.shift.findFirstOrThrow({
    where: {
      venueId: breakfastArea.venueId,
      departmentId: breakfastArea.departmentId,
      name: "Breakfast Live Shift",
    },
  });

  await prisma.customerDepartmentTippingSetting.update({
    where: {
      customerId_revenueCentreType: {
        customerId: breakfastArea.customerId,
        revenueCentreType: breakfastArea.department.revenueCentreType,
      },
    },
    data: {
      qrTippingEnabled: true,
      teamTippingEnabled: true,
      individualTippingEnabled: true,
      shiftSelectorEnabled: true,
    },
  });

  await prisma.serviceArea.update({
    where: { id: breakfastArea.id },
    data: {
      tippingMode: "SHIFT_SELECTOR",
      teamTippingEnabled: true,
      individualTippingEnabled: true,
    },
  });

  await prisma.shift.update({
    where: { id: breakfastShift.id },
    data: {
      status: "ACTIVE",
      startsAt: activeShiftStart,
      endsAt: activeShiftEnd,
    },
  });

  try {
    const response = await GET(new Request("http://localhost/api/tip/ssn-breakfast-table-card-a/staff-options"), {
      params: Promise.resolve({ slug: "ssn-breakfast-table-card-a" }),
    });

    assert.equal(response.status, 200);

    const payload = (await response.json()) as {
      data: {
        destinationType: string;
        tippingMode: string | null;
        selectionUi: string | null;
        individualSelectionEnabled: boolean;
        items: Array<{
          id: string;
          displayName: string;
          roleLabel?: string;
          sortOrder: number;
        }>;
      };
    };

    assert.equal(payload.data.destinationType, "SERVICE_AREA");
    assert.equal(payload.data.tippingMode, "SHIFT_SELECTOR");
    assert.equal(payload.data.selectionUi, "DROPDOWN");
    assert.equal(payload.data.individualSelectionEnabled, true);
    assert.deepEqual(
      payload.data.items.map((item) => ({
        displayName: item.displayName,
        roleLabel: item.roleLabel,
        sortOrder: item.sortOrder,
      })),
      [
        {
          displayName: "Emma",
          roleLabel: "Server",
          sortOrder: 0,
        },
        {
          displayName: "Josh",
          roleLabel: "Barista",
          sortOrder: 1,
        },
        {
          displayName: "Liam",
          roleLabel: "Runner",
          sortOrder: 2,
        },
        {
          displayName: "Maria",
          roleLabel: "Supervisor",
          sortOrder: 3,
        },
      ],
    );
  } finally {
    await prisma.customerDepartmentTippingSetting.update({
      where: {
        customerId_revenueCentreType: {
          customerId: breakfastArea.customerId,
          revenueCentreType: breakfastArea.department.revenueCentreType,
        },
      },
      data: {
        qrTippingEnabled: departmentSetting.qrTippingEnabled,
        teamTippingEnabled: departmentSetting.teamTippingEnabled,
        individualTippingEnabled: departmentSetting.individualTippingEnabled,
        shiftSelectorEnabled: departmentSetting.shiftSelectorEnabled,
      },
    });

    await prisma.serviceArea.update({
      where: { id: breakfastArea.id },
      data: {
        tippingMode: originalServiceArea.tippingMode,
        teamTippingEnabled: originalServiceArea.teamTippingEnabled,
        individualTippingEnabled: originalServiceArea.individualTippingEnabled,
      },
    });

    await prisma.shift.update({
      where: { id: breakfastShift.id },
      data: {
        status: breakfastShift.status,
        startsAt: breakfastShift.startsAt,
        endsAt: breakfastShift.endsAt,
      },
    });
  }
});

test("public tip staff options endpoint excludes team-only journeys from individual selection", async () => {
  const response = await GET(new Request("http://localhost/api/tip/ssn-room-service-tray-card/staff-options"), {
    params: Promise.resolve({ slug: "ssn-room-service-tray-card" }),
  });

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data: {
      tippingMode: string | null;
      individualSelectionEnabled: boolean;
      items: Array<{
        displayName: string;
        roleLabel?: string;
        sortOrder: number;
      }>;
    };
  };

  assert.equal(payload.data.tippingMode, "TEAM_ONLY");
  assert.equal(payload.data.individualSelectionEnabled, false);
  assert.deepEqual(payload.data.items, []);
});
