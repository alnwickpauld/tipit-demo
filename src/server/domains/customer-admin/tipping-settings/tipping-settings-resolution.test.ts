import assert from "node:assert/strict";
import test from "node:test";

import { resolveServiceAreaTippingConfig } from "../../../../lib/public-tip-config";

test("department rollout can disable a service area entirely", () => {
  const result = resolveServiceAreaTippingConfig(
    {
      qrTippingEnabled: false,
      teamTippingEnabled: true,
      individualTippingEnabled: true,
      shiftSelectorEnabled: true,
    },
    {
      tippingMode: "TEAM_OR_INDIVIDUAL",
      teamTippingEnabled: true,
      individualTippingEnabled: true,
    },
  );

  assert.equal(result.enabled, false);
});

test("service area can be downgraded to team only when individual tipping is disabled", () => {
  const result = resolveServiceAreaTippingConfig(
    {
      qrTippingEnabled: true,
      teamTippingEnabled: true,
      individualTippingEnabled: false,
      shiftSelectorEnabled: false,
    },
    {
      tippingMode: "TEAM_OR_INDIVIDUAL",
      teamTippingEnabled: true,
      individualTippingEnabled: true,
    },
  );

  assert.equal(result.enabled, true);
  assert.equal(result.effectiveTippingMode, "TEAM_ONLY");
  assert.equal(result.showTeamOption, false);
});

test("shift selector is only allowed when rollout enables it", () => {
  const result = resolveServiceAreaTippingConfig(
    {
      qrTippingEnabled: true,
      teamTippingEnabled: true,
      individualTippingEnabled: true,
      shiftSelectorEnabled: true,
    },
    {
      tippingMode: "SHIFT_SELECTOR",
      teamTippingEnabled: true,
      individualTippingEnabled: true,
    },
  );

  assert.equal(result.enabled, true);
  assert.equal(result.effectiveTippingMode, "SHIFT_SELECTOR");
  assert.equal(result.showTeamOption, true);
});
