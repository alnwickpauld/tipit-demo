import assert from "node:assert/strict";
import test from "node:test";

import {
  PoolDistributionError,
  PoolDistributionService,
} from "../services/pool-distribution-service";

test("pool distribution returns zero allocations and zero rate when total hours are zero", () => {
  const service = new PoolDistributionService();

  const result = service.calculateDistribution({
    poolTotal: 120,
    staff: [
      { staffMemberId: "staff-a", employeeName: "Ava", hoursWorked: 0 },
      { staffMemberId: "staff-b", employeeName: "Ben", hoursWorked: 0 },
    ],
  });

  assert.equal(result.poolTotal, 120);
  assert.equal(result.totalHoursWorked, 0);
  assert.equal(result.perHourRate, 0);
  assert.deepEqual(result.allocations, [
    {
      staffMemberId: "staff-a",
      employeeName: "Ava",
      hoursWorked: 0,
      allocationAmount: 0,
    },
    {
      staffMemberId: "staff-b",
      employeeName: "Ben",
      hoursWorked: 0,
      allocationAmount: 0,
    },
  ]);
});

test("pool distribution allocates uneven totals by hours and preserves the full pool value", () => {
  const service = new PoolDistributionService();

  const result = service.calculateDistribution({
    poolTotal: 100,
    staff: [
      { staffMemberId: "staff-a", employeeName: "Ava", hoursWorked: 1 },
      { staffMemberId: "staff-b", employeeName: "Ben", hoursWorked: 2 },
      { staffMemberId: "staff-c", employeeName: "Cara", hoursWorked: 3 },
    ],
  });

  assert.equal(result.totalHoursWorked, 6);
  assert.equal(result.perHourRate, 16.6667);
  assert.deepEqual(result.allocations, [
    {
      staffMemberId: "staff-a",
      employeeName: "Ava",
      hoursWorked: 1,
      allocationAmount: 16.67,
    },
    {
      staffMemberId: "staff-b",
      employeeName: "Ben",
      hoursWorked: 2,
      allocationAmount: 33.33,
    },
    {
      staffMemberId: "staff-c",
      employeeName: "Cara",
      hoursWorked: 3,
      allocationAmount: 50,
    },
  ]);

  assert.equal(
    Number(result.allocations.reduce((sum, allocation) => sum + allocation.allocationAmount, 0).toFixed(2)),
    100,
  );
});

test("pool distribution rejects duplicate staff rows", () => {
  const service = new PoolDistributionService();

  assert.throws(
    () =>
      service.calculateDistribution({
        poolTotal: 25,
        staff: [
          { staffMemberId: "staff-a", employeeName: "Ava", hoursWorked: 2 },
          { staffMemberId: "staff-a", employeeName: "Ava", hoursWorked: 3 },
        ],
      }),
    (error: unknown) => {
      assert.ok(error instanceof PoolDistributionError);
      assert.match((error as Error).message, /only appear once/i);
      return true;
    },
  );
});
