import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "../app/api/tip/[slug]/staff-options/route";
import { prisma } from "../lib/prisma";

test("public tip staff options endpoint returns dropdown-friendly filtered shift staff", async () => {
  const breakfastArea = await prisma.serviceArea.findFirstOrThrow({
    where: { slug: "breakfast-table-card" },
    include: { department: true },
  });
  const departmentSetting = await prisma.customerDepartmentTippingSetting.findUniqueOrThrow({
    where: {
      customerId_departmentType: {
        customerId: breakfastArea.customerId,
        departmentType: breakfastArea.department.type,
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
      name: "Breakfast Service",
    },
  });

  await prisma.customerDepartmentTippingSetting.update({
    where: {
      customerId_departmentType: {
        customerId: breakfastArea.customerId,
        departmentType: breakfastArea.department.type,
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
      startsAt: new Date("2026-04-02T00:00:00.000Z"),
      endsAt: new Date("2026-04-02T23:59:59.000Z"),
    },
  });

  try {
    const response = await GET(new Request("http://localhost/api/tip/breakfast-table-card/staff-options"), {
      params: Promise.resolve({ slug: "breakfast-table-card" }),
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
          displayName: "Maya",
          roleLabel: "Breakfast lead",
          sortOrder: 0,
        },
        {
          displayName: "Tom",
          roleLabel: "Breakfast host",
          sortOrder: 1,
        },
      ],
    );
  } finally {
    await prisma.customerDepartmentTippingSetting.update({
      where: {
        customerId_departmentType: {
          customerId: breakfastArea.customerId,
          departmentType: breakfastArea.department.type,
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
  const response = await GET(new Request("http://localhost/api/tip/newcastle-event-space-team/staff-options"), {
    params: Promise.resolve({ slug: "newcastle-event-space-team" }),
  });

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data: {
      tippingMode: string | null;
      individualSelectionEnabled: boolean;
      items: Array<unknown>;
    };
  };

  assert.equal(payload.data.tippingMode, "TEAM_ONLY");
  assert.equal(payload.data.individualSelectionEnabled, false);
  assert.deepEqual(payload.data.items, []);
});
