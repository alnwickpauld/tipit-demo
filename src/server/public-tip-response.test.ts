import assert from "node:assert/strict";
import test from "node:test";

import { resolvePublicTipDestinationBySlug } from "../lib/public-tip";
import { prisma } from "../lib/prisma";

test("public tip response enforces department rollout settings", async () => {
  const breakfastArea = await prisma.serviceArea.findFirstOrThrow({
    where: { slug: "ssn-breakfast-table-card-a" },
    include: {
      department: true,
    },
  });

  const before = await prisma.customerDepartmentTippingSetting.findUniqueOrThrow({
    where: {
      customerId_revenueCentreType: {
        customerId: breakfastArea.customerId,
        revenueCentreType: breakfastArea.department.revenueCentreType,
      },
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
      qrTippingEnabled: false,
    },
  });

  try {
    const destination = await resolvePublicTipDestinationBySlug("ssn-breakfast-table-card-a");
    assert.equal(destination, null);
  } finally {
    await prisma.customerDepartmentTippingSetting.update({
      where: {
        customerId_revenueCentreType: {
          customerId: breakfastArea.customerId,
          revenueCentreType: breakfastArea.department.revenueCentreType,
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
    where: { slug: "ssn-breakfast-table-card-a" },
    include: {
      department: true,
    },
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
    const destination = await resolvePublicTipDestinationBySlug("ssn-breakfast-table-card-a");
    assert.ok(destination?.serviceAreaJourney);
    assert.equal(destination?.serviceAreaJourney?.tippingMode, "TEAM_ONLY");
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
  }
});

test("public tip response resolves team QR assets as team-only journeys", async () => {
  const breakfastArea = await prisma.serviceArea.findFirstOrThrow({
    where: { slug: "ssn-breakfast-table-card-a" },
  });
  const qrSlug = `test-breakfast-team-${Date.now()}`;
  await prisma.qrAsset.create({
    data: {
      customerId: breakfastArea.customerId,
      venueId: breakfastArea.venueId,
      departmentId: breakfastArea.departmentId,
      serviceAreaId: breakfastArea.id,
      slug: qrSlug,
      destinationType: "TEAM",
      label: "Breakfast Team Test QR",
      printName: "Breakfast Team Test QR",
      displayMode: "TABLE_CARD",
    },
  });

  try {
    const destination = await resolvePublicTipDestinationBySlug(qrSlug);

    assert.ok(destination?.serviceAreaJourney);
    assert.equal(destination?.destinationType, "SERVICE_AREA");
    assert.equal(destination?.serviceAreaJourney?.tippingMode, "TEAM_ONLY");
    assert.equal(destination?.serviceAreaJourney?.showTeamOption, false);
  } finally {
    await prisma.qrAsset.deleteMany({ where: { slug: qrSlug } });
  }
});

test("public tip response inherits outlet-brand identity from the service area department", async () => {
  const breakfastArea = await prisma.serviceArea.findFirstOrThrow({
    where: { slug: "ssn-breakfast-table-card-a" },
    include: {
      venue: true,
      department: {
        include: {
          outletBrand: true,
        },
      },
    },
  });

  const destination = await resolvePublicTipDestinationBySlug("ssn-breakfast-table-card-a");

  assert.ok(destination);
  assert.equal(destination?.outletBrandId, breakfastArea.department.outletBrandId);
  assert.equal(destination?.brandDisplayName, breakfastArea.department.outletBrand.displayName);
  assert.equal(destination?.brandLogoImageUrl, breakfastArea.venue.brandLogoImageUrl);
});

test("public tip response prefers service area tip-screen overrides and otherwise falls back to venue styling", async () => {
  const breakfastArea = await prisma.serviceArea.findFirstOrThrow({
    where: { slug: "ssn-breakfast-table-card-a" },
    include: {
      venue: true,
    },
  });

  const original = await prisma.serviceArea.findUniqueOrThrow({
    where: { id: breakfastArea.id },
  });

  await prisma.serviceArea.update({
    where: { id: breakfastArea.id },
    data: {
      tipScreenBackgroundColor: "#123456",
      tipScreenTextColor: "#f5f5f5",
      tipScreenButtonColor: "#345678",
      tipScreenButtonTextColor: "#fff0aa",
      tipScreenLogoImageUrl: "https://example.com/service-area-logo.png",
    },
  });

  try {
    const overridden = await resolvePublicTipDestinationBySlug("ssn-breakfast-table-card-a");

    assert.ok(overridden);
    assert.equal(overridden?.brandBackgroundColor, "#123456");
    assert.equal(overridden?.brandTextColor, "#f5f5f5");
    assert.equal(overridden?.brandButtonColor, "#345678");
    assert.equal(overridden?.brandButtonTextColor, "#fff0aa");
    assert.equal(overridden?.brandLogoImageUrl, "https://example.com/service-area-logo.png");

    await prisma.serviceArea.update({
      where: { id: breakfastArea.id },
      data: {
        tipScreenBackgroundColor: null,
        tipScreenTextColor: null,
        tipScreenButtonColor: null,
        tipScreenButtonTextColor: null,
        tipScreenLogoImageUrl: null,
      },
    });

    const fallback = await resolvePublicTipDestinationBySlug("ssn-breakfast-table-card-a");

    assert.ok(fallback);
    assert.equal(fallback?.brandBackgroundColor, breakfastArea.venue.brandBackgroundColor);
    assert.equal(fallback?.brandTextColor, breakfastArea.venue.brandTextColor);
    assert.equal(fallback?.brandButtonColor, breakfastArea.venue.brandButtonColor);
    assert.equal(fallback?.brandButtonTextColor, breakfastArea.venue.brandButtonTextColor);
    assert.equal(fallback?.brandLogoImageUrl, breakfastArea.venue.brandLogoImageUrl);
  } finally {
    await prisma.serviceArea.update({
      where: { id: breakfastArea.id },
      data: {
        tipScreenBackgroundColor: original.tipScreenBackgroundColor,
        tipScreenTextColor: original.tipScreenTextColor,
        tipScreenButtonColor: original.tipScreenButtonColor,
        tipScreenButtonTextColor: original.tipScreenButtonTextColor,
        tipScreenLogoImageUrl: original.tipScreenLogoImageUrl,
      },
    });
  }
});
