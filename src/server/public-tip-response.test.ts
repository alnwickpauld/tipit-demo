import assert from "node:assert/strict";
import test from "node:test";

import { resolvePublicTipDestinationBySlug } from "../lib/public-tip";
import { prisma } from "../lib/prisma";

test("public tip response enforces department rollout settings", async () => {
  const breakfastArea = await prisma.serviceArea.findFirstOrThrow({
    where: { slug: "breakfast-table-card" },
    include: {
      department: true,
    },
  });

  const before = await prisma.customerDepartmentTippingSetting.findUniqueOrThrow({
    where: {
      customerId_departmentType: {
        customerId: breakfastArea.customerId,
        departmentType: breakfastArea.department.type,
      },
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
      qrTippingEnabled: false,
    },
  });

  try {
    const destination = await resolvePublicTipDestinationBySlug("breakfast-table-card");
    assert.equal(destination, null);
  } finally {
    await prisma.customerDepartmentTippingSetting.update({
      where: {
        customerId_departmentType: {
          customerId: breakfastArea.customerId,
          departmentType: breakfastArea.department.type,
        },
      },
      data: {
        qrTippingEnabled: before.qrTippingEnabled,
      },
    });
  }
});

test("public tip response downgrades service area journey when individual tipping is disabled", async () => {
  const breakfastArea = await prisma.serviceArea.findFirstOrThrow({
    where: { slug: "breakfast-table-card" },
    include: {
      department: true,
    },
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
      individualTippingEnabled: false,
      shiftSelectorEnabled: false,
    },
  });

  await prisma.serviceArea.update({
    where: { id: breakfastArea.id },
    data: {
      tippingMode: "TEAM_OR_INDIVIDUAL",
      teamTippingEnabled: true,
      individualTippingEnabled: true,
    },
  });

  try {
    const destination = await resolvePublicTipDestinationBySlug("breakfast-table-card");
    assert.ok(destination?.serviceAreaJourney);
    assert.equal(destination?.serviceAreaJourney?.tippingMode, "TEAM_ONLY");
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
  }
});

test("public tip response resolves team QR assets as team-only journeys", async () => {
  const destination = await resolvePublicTipDestinationBySlug("newcastle-event-space-team");

  assert.ok(destination?.serviceAreaJourney);
  assert.equal(destination?.destinationType, "SERVICE_AREA");
  assert.equal(destination?.serviceAreaJourney?.tippingMode, "TEAM_ONLY");
  assert.equal(destination?.serviceAreaJourney?.showTeamOption, false);
});
