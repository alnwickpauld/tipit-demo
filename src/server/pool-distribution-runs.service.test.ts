import assert from "node:assert/strict";
import test from "node:test";

import { calculatePoolDistribution } from "./domains/customer-admin/pool-distributions/pool-distributions.service";
import { ValidationAppError } from "./shared/errors/app-error";

test("manual pool distribution calculates pool total 500 across 300 hours and keeps full precision until final rounding", () => {
  const result = calculatePoolDistribution({
    poolTotal: 500,
    employees: [
      {
        employeeId: "employee-1",
        employeeName: "Alice",
        payrollReference: "PR-001",
        hoursWorked: 90,
        hoursSource: "MANUAL",
      },
      {
        employeeId: "employee-2",
        employeeName: "Ben",
        payrollReference: "PR-002",
        hoursWorked: 10,
        hoursSource: "MANUAL",
      },
      {
        employeeId: "employee-3",
        employeeName: "Cara",
        payrollReference: "PR-003",
        hoursWorked: 200,
        hoursSource: "MANUAL",
      },
    ],
  });

  assert.equal(result.totalHours, 300);
  assert.equal(result.perHourRate, 1.66666667);
  assert.deepEqual(
    result.allocations.map((allocation) => ({
      employeeId: allocation.employeeId,
      allocationAmount: allocation.allocationAmount,
    })),
    [
      { employeeId: "employee-1", allocationAmount: 150 },
      { employeeId: "employee-2", allocationAmount: 16.67 },
      { employeeId: "employee-3", allocationAmount: 333.33 },
    ],
  );
});

test("manual pool distribution handles zero sales-style pool totals and zero discounts inputs", () => {
  const result = calculatePoolDistribution({
    poolTotal: 0,
    employees: [
      {
        employeeId: "employee-1",
        employeeName: "Alice",
        payrollReference: null,
        hoursWorked: 12,
        hoursSource: "MANUAL",
      },
    ],
  });

  assert.equal(result.totalHours, 12);
  assert.equal(result.perHourRate, 0);
  assert.equal(result.allocations[0]?.allocationAmount, 0);
});

test("manual pool distribution rejects zero total hours", () => {
  assert.throws(
    () =>
      calculatePoolDistribution({
        poolTotal: 500,
        employees: [
          {
            employeeId: "employee-1",
            employeeName: "Alice",
            payrollReference: null,
            hoursWorked: 0,
            hoursSource: "MANUAL",
          },
        ],
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationAppError);
      assert.match(error.message, /total eligible hours are zero/i);
      return true;
    },
  );
});

test("manual pool distribution rejects invalid negative hours input", () => {
  assert.throws(
    () =>
      calculatePoolDistribution({
        poolTotal: 500,
        employees: [
          {
            employeeId: "employee-1",
            employeeName: "Alice",
            payrollReference: null,
            hoursWorked: -2,
            hoursSource: "MANUAL",
          },
        ],
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationAppError);
      assert.match(error.message, /hours worked/i);
      return true;
    },
  );
});

test("manual pool distribution applies rounding reconciliation to the final eligible employee", () => {
  const result = calculatePoolDistribution({
    poolTotal: 100,
    employees: [
      {
        employeeId: "employee-1",
        employeeName: "Alice",
        payrollReference: null,
        hoursWorked: 1,
        hoursSource: "MANUAL",
      },
      {
        employeeId: "employee-2",
        employeeName: "Ben",
        payrollReference: null,
        hoursWorked: 1,
        hoursSource: "MANUAL",
      },
      {
        employeeId: "employee-3",
        employeeName: "Cara",
        payrollReference: null,
        hoursWorked: 1,
        hoursSource: "MANUAL",
      },
    ],
  });

  assert.equal(result.roundingAdjustment, 0.01);
  assert.deepEqual(
    result.allocations.map((allocation) => allocation.allocationAmount),
    [33.33, 33.33, 33.34],
  );
  assert.equal(
    Number(result.allocations.reduce((sum, allocation) => sum + allocation.allocationAmount, 0).toFixed(2)),
    100,
  );
});
