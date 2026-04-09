import assert from "node:assert/strict";
import test from "node:test";

import { ShiftEligibilityService } from "../../../../lib/shift-eligibility";

test("shift eligibility returns only active assigned staff who are tip-eligible", async () => {
  const service = new ShiftEligibilityService({
    shift: {
      findFirst: async () => ({
        id: "shift_1",
        staffAssignments: [
          {
            role: "Breakfast lead",
            eligibleForTips: true,
            staffMember: {
              id: "staff_1",
              firstName: "Maya",
              lastName: "Patel",
              displayName: "Maya",
              status: "ACTIVE",
              departmentAssignments: [{ id: "assignment_1" }],
            },
          },
          {
            role: "Host",
            eligibleForTips: true,
            staffMember: {
              id: "staff_2",
              firstName: "Tom",
              lastName: "Reeves",
              displayName: "Tom",
              status: "INACTIVE",
              departmentAssignments: [{ id: "assignment_2" }],
            },
          },
          {
            role: "Server",
            eligibleForTips: true,
            staffMember: {
              id: "staff_3",
              firstName: "Aisha",
              lastName: "Khan",
              displayName: "Aisha",
              status: "ACTIVE",
              departmentAssignments: [],
            },
          },
          {
            role: "Breakfast host",
            eligibleForTips: true,
            staffMember: {
              id: "staff_0",
              firstName: "Aaron",
              lastName: "Bell",
              displayName: "Aaron",
              status: "ACTIVE",
              departmentAssignments: [{ id: "assignment_0" }],
            },
          },
        ],
      }),
    },
  } as never);

  const result = await service.getActiveShiftStaffByServiceArea({
    serviceAreaId: "service_area_1",
    venueId: "venue_1",
    departmentId: "department_1",
    tippingMode: "SHIFT_SELECTOR",
    noActiveShiftBehavior: "DISABLE_INDIVIDUAL",
  });

  assert.equal(result.effectiveTippingMode, "SHIFT_SELECTOR");
  assert.equal(result.individualTippingUnavailable, false);
  assert.deepEqual(result.staffOptions, [
    {
      id: "staff_0",
      displayName: "Aaron",
      roleLabel: "Breakfast host",
      sortOrder: 0,
    },
    {
      id: "staff_1",
      displayName: "Maya",
      roleLabel: "Breakfast lead",
      sortOrder: 1,
    },
  ]);
});

test("shift eligibility falls back to team mode when configured and no active shift exists", async () => {
  const service = new ShiftEligibilityService({
    shift: {
      findFirst: async () => null,
    },
  } as never);

  const result = await service.getActiveShiftStaffByServiceArea({
    serviceAreaId: "service_area_2",
    venueId: "venue_1",
    departmentId: "department_1",
    tippingMode: "TEAM_OR_INDIVIDUAL",
    noActiveShiftBehavior: "FALLBACK_TO_TEAM",
  });

  assert.equal(result.effectiveTippingMode, "TEAM_ONLY");
  assert.equal(result.individualTippingUnavailable, false);
  assert.deepEqual(result.staffOptions, []);
});

test("shift eligibility preserves team-or-individual journeys when no active shift exists", async () => {
  const service = new ShiftEligibilityService({
    shift: {
      findFirst: async () => null,
    },
  } as never);

  const result = await service.getActiveShiftStaffByServiceArea({
    serviceAreaId: "service_area_2b",
    venueId: "venue_1",
    departmentId: "department_1",
    tippingMode: "TEAM_OR_INDIVIDUAL",
    noActiveShiftBehavior: "DISABLE_INDIVIDUAL",
  });

  assert.equal(result.effectiveTippingMode, "TEAM_OR_INDIVIDUAL");
  assert.equal(result.individualTippingUnavailable, true);
  assert.match(result.individualTippingMessage ?? "", /individual tipping is unavailable/i);
  assert.deepEqual(result.staffOptions, []);
});

test("shift eligibility disables individual tipping when configured and no active shift exists", async () => {
  const service = new ShiftEligibilityService({
    shift: {
      findFirst: async () => null,
    },
  } as never);

  const result = await service.getActiveShiftStaffByServiceArea({
    serviceAreaId: "service_area_3",
    venueId: "venue_1",
    departmentId: "department_1",
    tippingMode: "INDIVIDUAL_ONLY",
    noActiveShiftBehavior: "DISABLE_INDIVIDUAL",
  });

  assert.equal(result.effectiveTippingMode, "INDIVIDUAL_ONLY");
  assert.equal(result.individualTippingUnavailable, true);
  assert.match(result.individualTippingMessage ?? "", /active shift/i);
  assert.deepEqual(result.staffOptions, []);
});
