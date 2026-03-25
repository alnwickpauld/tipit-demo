import test from "node:test";
import assert from "node:assert/strict";

import {
  PayrollCalculationError,
  PayrollCalculationInput,
  PayrollCalculationRepository,
  PayrollCalculationService,
  PayrollAllocationRule,
  PayrollEmployee,
  PayrollPoolMembership,
  PayrollTipTransaction,
} from "./payroll-calculation-service.js";

class InMemoryPayrollRepository implements PayrollCalculationRepository {
  constructor(
    private readonly data: {
      employees: PayrollEmployee[];
      poolMemberships: PayrollPoolMembership[];
      allocationRules: PayrollAllocationRule[];
      tipTransactions: PayrollTipTransaction[];
    },
  ) {}

  async getPayrollCalculationData(_input: PayrollCalculationInput) {
    return this.data;
  }
}

const customerId = "cust_1";
const venueId = "venue_1";
const venueTipDestinationId = "venue_destination_1";
const employeeAId = "employee_a";
const employeeBId = "employee_b";
const employeeCId = "employee_c";
const poolId = "pool_1";

const employees: PayrollEmployee[] = [
  { id: employeeAId, customerId, name: "Ava Brooks" },
  { id: employeeBId, customerId, name: "Ben Carter" },
  { id: employeeCId, customerId, name: "Cara Doyle" },
];

function createMembership(
  employeeId: string,
  joinedAt: string,
  leftAt: string | null = null,
  isActive = true,
): PayrollPoolMembership {
  return {
    poolId,
    employeeId,
    joinedAt: new Date(joinedAt),
    leftAt: leftAt ? new Date(leftAt) : null,
    isActive,
  };
}

function createTip(
  id: string,
  occurredAt: string,
  grossAmount: number,
  destinationType: "EMPLOYEE" | "POOL" | "VENUE",
  destinationId?: string,
): PayrollTipTransaction {
  return {
    id,
    customerId,
    venueId,
    qrCodeId: null,
    destinationType,
    destinationEmployeeId: destinationType === "EMPLOYEE" ? destinationId ?? employeeAId : null,
    destinationPoolId: destinationType === "POOL" ? destinationId ?? poolId : null,
    destinationVenueId: destinationType === "VENUE" ? destinationId ?? venueTipDestinationId : null,
    status: "SUCCEEDED",
    grossAmount,
    occurredAt: new Date(occurredAt),
  };
}

const baseRules: PayrollAllocationRule[] = [
  {
    id: "rule_employee_direct",
    customerId,
    venueId,
    isActive: true,
    priority: 10,
    appliesToQrCodeId: null,
    appliesToDestinationType: "EMPLOYEE",
    appliesToEmployeeId: employeeAId,
    appliesToPoolId: null,
    appliesToVenueId: null,
    effectiveFrom: null,
    effectiveTo: null,
    lines: [
      {
        id: "line_employee_direct",
        targetType: "EMPLOYEE",
        employeeId: employeeAId,
        poolId: null,
        percentageBps: 10000,
        sortOrder: 1,
      },
    ],
  },
  {
    id: "rule_pool_direct",
    customerId,
    venueId,
    isActive: true,
    priority: 20,
    appliesToQrCodeId: null,
    appliesToDestinationType: "POOL",
    appliesToEmployeeId: null,
    appliesToPoolId: poolId,
    appliesToVenueId: null,
    effectiveFrom: null,
    effectiveTo: null,
    lines: [
      {
        id: "line_pool_direct",
        targetType: "POOL",
        employeeId: null,
        poolId,
        percentageBps: 10000,
        sortOrder: 1,
      },
    ],
  },
  {
    id: "rule_venue_split",
    customerId,
    venueId,
    isActive: true,
    priority: 30,
    appliesToQrCodeId: null,
    appliesToDestinationType: "VENUE",
    appliesToEmployeeId: null,
    appliesToPoolId: null,
    appliesToVenueId: venueTipDestinationId,
    effectiveFrom: null,
    effectiveTo: null,
    lines: [
      {
        id: "line_venue_employee",
        targetType: "EMPLOYEE",
        employeeId: employeeBId,
        poolId: null,
        percentageBps: 5000,
        sortOrder: 1,
      },
      {
        id: "line_venue_pool",
        targetType: "POOL",
        employeeId: null,
        poolId,
        percentageBps: 5000,
        sortOrder: 2,
      },
    ],
  },
];

test("calculates weekly payroll with direct, pool, and mixed venue allocations", async () => {
  const repository = new InMemoryPayrollRepository({
    employees,
    poolMemberships: [
      createMembership(employeeAId, "2026-03-01T00:00:00.000Z"),
      createMembership(employeeBId, "2026-03-01T00:00:00.000Z"),
    ],
    allocationRules: baseRules,
    tipTransactions: [
      createTip("tip_1", "2026-03-17T10:00:00.000Z", 20, "EMPLOYEE", employeeAId),
      createTip("tip_2", "2026-03-18T11:00:00.000Z", 18, "POOL", poolId),
      createTip("tip_3", "2026-03-19T12:00:00.000Z", 10, "VENUE", venueTipDestinationId),
      {
        ...createTip("tip_ignored_failed", "2026-03-20T12:00:00.000Z", 99, "EMPLOYEE", employeeAId),
        status: "FAILED",
      },
    ],
  });

  const service = new PayrollCalculationService(repository);
  const result = await service.calculate({
    customerId,
    periodStart: new Date("2026-03-16T00:00:00.000Z"),
    periodEnd: new Date("2026-03-22T23:59:59.999Z"),
  });

  assert.deepEqual(result.rows, [
    {
      employeeId: employeeAId,
      employeeName: "Ava Brooks",
      grossTips: 34,
      tipCount: 3,
      averageTip: 11.33,
      rank: 1,
    },
    {
      employeeId: employeeBId,
      employeeName: "Ben Carter",
      grossTips: 14,
      tipCount: 2,
      averageTip: 7,
      rank: 2,
    },
  ]);

  assert.deepEqual(result.summary, {
    customerId,
    periodStart: new Date("2026-03-16T00:00:00.000Z"),
    periodEnd: new Date("2026-03-22T23:59:59.999Z"),
    grossTips: 48,
    tipCount: 3,
    employeeCount: 2,
  });
});

test("calculates fortnightly payroll and respects membership changes at tip time", async () => {
  const repository = new InMemoryPayrollRepository({
    employees,
    poolMemberships: [
      createMembership(employeeAId, "2026-03-01T00:00:00.000Z"),
      createMembership(employeeBId, "2026-03-01T00:00:00.000Z", "2026-03-10T23:59:59.000Z"),
      createMembership(employeeCId, "2026-03-11T00:00:00.000Z"),
    ],
    allocationRules: baseRules.filter((rule) => rule.id === "rule_pool_direct"),
    tipTransactions: [
      createTip("tip_1", "2026-03-05T10:00:00.000Z", 12, "POOL", poolId),
      createTip("tip_2", "2026-03-12T10:00:00.000Z", 12, "POOL", poolId),
    ],
  });

  const service = new PayrollCalculationService(repository);
  const result = await service.calculate({
    customerId,
    periodStart: new Date("2026-03-01T00:00:00.000Z"),
    periodEnd: new Date("2026-03-14T23:59:59.999Z"),
  });

  assert.deepEqual(result.rows, [
    {
      employeeId: employeeAId,
      employeeName: "Ava Brooks",
      grossTips: 12,
      tipCount: 2,
      averageTip: 6,
      rank: 1,
    },
    {
      employeeId: employeeBId,
      employeeName: "Ben Carter",
      grossTips: 6,
      tipCount: 1,
      averageTip: 6,
      rank: 2,
    },
    {
      employeeId: employeeCId,
      employeeName: "Cara Doyle",
      grossTips: 6,
      tipCount: 1,
      averageTip: 6,
      rank: 2,
    },
  ]);

  assert.deepEqual(result.summary, {
    customerId,
    periodStart: new Date("2026-03-01T00:00:00.000Z"),
    periodEnd: new Date("2026-03-14T23:59:59.999Z"),
    grossTips: 24,
    tipCount: 2,
    employeeCount: 3,
  });
});

test("calculates monthly payroll across the full month window", async () => {
  const repository = new InMemoryPayrollRepository({
    employees,
    poolMemberships: [
      createMembership(employeeAId, "2026-02-01T00:00:00.000Z"),
      createMembership(employeeBId, "2026-02-01T00:00:00.000Z"),
    ],
    allocationRules: baseRules,
    tipTransactions: [
      createTip("tip_1", "2026-02-01T09:00:00.000Z", 30, "EMPLOYEE", employeeAId),
      createTip("tip_2", "2026-02-14T09:00:00.000Z", 20, "POOL", poolId),
      createTip("tip_3", "2026-02-28T22:59:59.000Z", 40, "VENUE", venueTipDestinationId),
      createTip("tip_ignored_outside", "2026-03-01T00:00:00.000Z", 100, "EMPLOYEE", employeeAId),
    ],
  });

  const service = new PayrollCalculationService(repository);
  const result = await service.calculate({
    customerId,
    periodStart: new Date("2026-02-01T00:00:00.000Z"),
    periodEnd: new Date("2026-02-28T23:59:59.999Z"),
  });

  assert.deepEqual(result.rows, [
    {
      employeeId: employeeAId,
      employeeName: "Ava Brooks",
      grossTips: 60,
      tipCount: 3,
      averageTip: 20,
      rank: 1,
    },
    {
      employeeId: employeeBId,
      employeeName: "Ben Carter",
      grossTips: 30,
      tipCount: 2,
      averageTip: 15,
      rank: 2,
    },
  ]);

  assert.deepEqual(result.summary, {
    customerId,
    periodStart: new Date("2026-02-01T00:00:00.000Z"),
    periodEnd: new Date("2026-02-28T23:59:59.999Z"),
    grossTips: 90,
    tipCount: 3,
    employeeCount: 2,
  });
});

test("throws when a resolved allocation rule does not total 100 percent", async () => {
  const repository = new InMemoryPayrollRepository({
    employees,
    poolMemberships: [createMembership(employeeAId, "2026-03-01T00:00:00.000Z")],
    allocationRules: [
      {
        id: "invalid_rule",
        customerId,
        venueId,
        isActive: true,
        priority: 1,
        appliesToQrCodeId: null,
        appliesToDestinationType: "EMPLOYEE",
        appliesToEmployeeId: employeeAId,
        appliesToPoolId: null,
        appliesToVenueId: null,
        effectiveFrom: null,
        effectiveTo: null,
        lines: [
          {
            id: "invalid_line",
            targetType: "EMPLOYEE",
            employeeId: employeeAId,
            poolId: null,
            percentageBps: 9000,
            sortOrder: 1,
          },
        ],
      },
    ],
    tipTransactions: [createTip("tip_1", "2026-03-17T10:00:00.000Z", 20, "EMPLOYEE", employeeAId)],
  });

  const service = new PayrollCalculationService(repository);

  await assert.rejects(
    () =>
      service.calculate({
        customerId,
        periodStart: new Date("2026-03-16T00:00:00.000Z"),
        periodEnd: new Date("2026-03-22T23:59:59.999Z"),
      }),
    (error: unknown) => {
      assert.ok(error instanceof PayrollCalculationError);
      assert.match(
        (error as Error).message,
        /percentage total must equal 10000/i,
      );
      return true;
    },
  );
});

test("throws when a successful tip cannot resolve to an allocation rule", async () => {
  const repository = new InMemoryPayrollRepository({
    employees,
    poolMemberships: [createMembership(employeeAId, "2026-03-01T00:00:00.000Z")],
    allocationRules: [],
    tipTransactions: [createTip("tip_1", "2026-03-17T10:00:00.000Z", 20, "EMPLOYEE", employeeAId)],
  });

  const service = new PayrollCalculationService(repository);

  await assert.rejects(
    () =>
      service.calculate({
        customerId,
        periodStart: new Date("2026-03-16T00:00:00.000Z"),
        periodEnd: new Date("2026-03-22T23:59:59.999Z"),
      }),
    (error: unknown) => {
      assert.ok(error instanceof PayrollCalculationError);
      assert.match((error as Error).message, /no allocation rule found/i);
      return true;
    },
  );
});
