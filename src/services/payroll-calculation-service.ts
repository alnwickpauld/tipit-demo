export type TransactionStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
export type AllocationTargetType = "EMPLOYEE" | "POOL";
export type QrDestinationType = "EMPLOYEE" | "POOL" | "VENUE";

export interface PayrollCalculationInput {
  customerId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface PayrollEmployee {
  id: string;
  customerId: string;
  name: string;
}

export interface PayrollPoolMembership {
  poolId: string;
  employeeId: string;
  joinedAt: Date;
  leftAt: Date | null;
  isActive: boolean;
}

export interface PayrollAllocationRuleLine {
  id: string;
  targetType: AllocationTargetType;
  employeeId: string | null;
  poolId: string | null;
  percentageBps: number;
  sortOrder: number;
}

export interface PayrollAllocationRule {
  id: string;
  customerId: string;
  venueId: string;
  isActive: boolean;
  priority: number;
  appliesToQrCodeId: string | null;
  appliesToDestinationType: QrDestinationType | null;
  appliesToEmployeeId: string | null;
  appliesToPoolId: string | null;
  appliesToVenueId: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  lines: PayrollAllocationRuleLine[];
}

export interface PayrollTipTransaction {
  id: string;
  customerId: string;
  venueId: string;
  qrCodeId: string | null;
  destinationType: QrDestinationType;
  destinationEmployeeId: string | null;
  destinationPoolId: string | null;
  destinationVenueId: string | null;
  status: TransactionStatus;
  grossAmount: number;
  occurredAt: Date;
}

export interface PayrollCalculationRepositoryData {
  employees: PayrollEmployee[];
  poolMemberships: PayrollPoolMembership[];
  allocationRules: PayrollAllocationRule[];
  tipTransactions: PayrollTipTransaction[];
}

export interface PayrollCalculationRepository {
  getPayrollCalculationData(
    input: PayrollCalculationInput,
  ): Promise<PayrollCalculationRepositoryData>;
}

export interface PayrollReportRow {
  employeeId: string;
  employeeName: string;
  grossTips: number;
  tipCount: number;
  averageTip: number;
  rank: number;
}

export interface PayrollReportSummary {
  customerId: string;
  periodStart: Date;
  periodEnd: Date;
  grossTips: number;
  tipCount: number;
  employeeCount: number;
}

export interface PayrollCalculationResult {
  rows: PayrollReportRow[];
  summary: PayrollReportSummary;
}

type EmployeeAggregate = {
  employeeId: string;
  employeeName: string;
  grossTipsCents: number;
  tipIds: Set<string>;
};

const BASIS_POINTS_TOTAL = 10_000;

export class PayrollCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayrollCalculationError";
  }
}

export class PayrollCalculationService {
  constructor(private readonly repository: PayrollCalculationRepository) {}

  async calculate(input: PayrollCalculationInput): Promise<PayrollCalculationResult> {
    this.assertPeriod(input.periodStart, input.periodEnd);

    const data = await this.repository.getPayrollCalculationData(input);
    const employeeMap = new Map(data.employees.map((employee) => [employee.id, employee]));
    const aggregates = new Map<string, EmployeeAggregate>();

    const successfulTips = data.tipTransactions.filter((tip) => {
      return (
        tip.customerId === input.customerId &&
        tip.status === "SUCCEEDED" &&
        tip.occurredAt >= input.periodStart &&
        tip.occurredAt <= input.periodEnd
      );
    });

    for (const tip of successfulTips) {
      const rule = resolveAllocationRule(tip, data.allocationRules);
      if (!rule) {
        throw new PayrollCalculationError(`No allocation rule found for tip ${tip.id}`);
      }

      validateRule(rule);

      const sortedLines = rule.lines.slice().sort((a, b) => a.sortOrder - b.sortOrder);
      const lineAllocations = allocateRuleLines(tip.grossAmount, sortedLines);

      for (const line of sortedLines) {
        const allocationAmountCents = lineAllocations.get(line.id) ?? 0;

        if (line.targetType === "EMPLOYEE") {
          if (!line.employeeId) {
            throw new PayrollCalculationError(
              `Allocation rule line ${line.id} is missing employeeId`,
            );
          }

          const employee = employeeMap.get(line.employeeId);
          if (!employee) {
            throw new PayrollCalculationError(
              `Allocation rule line ${line.id} references unknown employee ${line.employeeId}`,
            );
          }

          addAllocation(aggregates, employee, tip.id, allocationAmountCents);
          continue;
        }

        if (!line.poolId) {
          throw new PayrollCalculationError(`Allocation rule line ${line.id} is missing poolId`);
        }

        const activeMembers = getActivePoolMembers(
          line.poolId,
          tip.occurredAt,
          data.poolMemberships,
          employeeMap,
        );

        if (activeMembers.length === 0) {
          throw new PayrollCalculationError(
            `Pool ${line.poolId} has no active members for tip ${tip.id}`,
          );
        }

        const splitAmounts = splitEvenlyCents(allocationAmountCents, activeMembers.length);
        activeMembers.forEach((employee, index) => {
          addAllocation(aggregates, employee, tip.id, splitAmounts[index]);
        });
      }
    }

    const rows = Array.from(aggregates.values())
      .map((aggregate) => ({
        employeeId: aggregate.employeeId,
        employeeName: aggregate.employeeName,
        grossTips: centsToAmount(aggregate.grossTipsCents),
        tipCount: aggregate.tipIds.size,
        averageTip:
          aggregate.tipIds.size === 0
            ? 0
            : centsToAmount(Math.round(aggregate.grossTipsCents / aggregate.tipIds.size)),
        rank: 0,
      }))
      .sort((left, right) => {
        if (right.grossTips !== left.grossTips) {
          return right.grossTips - left.grossTips;
        }
        return left.employeeName.localeCompare(right.employeeName);
      });

    let currentRank = 0;
    let previousGrossTips: number | null = null;
    rows.forEach((row, index) => {
      if (previousGrossTips !== row.grossTips) {
        currentRank = index + 1;
        previousGrossTips = row.grossTips;
      }

      row.rank = currentRank;
    });

    return {
      rows,
      summary: {
        customerId: input.customerId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        grossTips: centsToAmount(
          rows.reduce((total, row) => total + amountToCents(row.grossTips), 0),
        ),
        tipCount: successfulTips.length,
        employeeCount: rows.length,
      },
    };
  }

  private assertPeriod(periodStart: Date, periodEnd: Date) {
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      throw new PayrollCalculationError("Payroll period dates must be valid");
    }

    if (periodStart > periodEnd) {
      throw new PayrollCalculationError("Payroll period start must be before end");
    }
  }
}

function resolveAllocationRule(
  tip: PayrollTipTransaction,
  rules: PayrollAllocationRule[],
): PayrollAllocationRule | null {
  const matchingRules = rules.filter((rule) => {
    if (!rule.isActive || rule.customerId !== tip.customerId || rule.venueId !== tip.venueId) {
      return false;
    }

    if (rule.effectiveFrom && tip.occurredAt < rule.effectiveFrom) {
      return false;
    }

    if (rule.effectiveTo && tip.occurredAt > rule.effectiveTo) {
      return false;
    }

    if (rule.appliesToQrCodeId && rule.appliesToQrCodeId !== tip.qrCodeId) {
      return false;
    }

    if (
      rule.appliesToDestinationType &&
      rule.appliesToDestinationType !== tip.destinationType
    ) {
      return false;
    }

    if (
      rule.appliesToEmployeeId &&
      rule.appliesToEmployeeId !== tip.destinationEmployeeId
    ) {
      return false;
    }

    if (rule.appliesToPoolId && rule.appliesToPoolId !== tip.destinationPoolId) {
      return false;
    }

    if (rule.appliesToVenueId) {
      const targetVenueId = tip.destinationVenueId ?? tip.venueId;
      if (rule.appliesToVenueId !== targetVenueId) {
        return false;
      }
    }

    return true;
  });

  if (matchingRules.length === 0) {
    return null;
  }

  return matchingRules.sort((left, right) => {
    const specificityDiff = ruleSpecificityScore(right) - ruleSpecificityScore(left);
    if (specificityDiff !== 0) {
      return specificityDiff;
    }

    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    return left.id.localeCompare(right.id);
  })[0];
}

function ruleSpecificityScore(rule: PayrollAllocationRule) {
  return [
    rule.appliesToQrCodeId,
    rule.appliesToDestinationType,
    rule.appliesToEmployeeId,
    rule.appliesToPoolId,
    rule.appliesToVenueId,
  ].filter(Boolean).length;
}

function validateRule(rule: PayrollAllocationRule) {
  if (rule.lines.length === 0) {
    throw new PayrollCalculationError(`Allocation rule ${rule.id} has no lines`);
  }

  const totalBps = rule.lines.reduce((total, line) => total + line.percentageBps, 0);
  if (totalBps !== BASIS_POINTS_TOTAL) {
    throw new PayrollCalculationError(
      `Allocation rule ${rule.id} percentage total must equal ${BASIS_POINTS_TOTAL}, received ${totalBps}`,
    );
  }
}

function getActivePoolMembers(
  poolId: string,
  occurredAt: Date,
  memberships: PayrollPoolMembership[],
  employeeMap: Map<string, PayrollEmployee>,
) {
  return memberships
    .filter((membership) => {
      if (membership.poolId !== poolId || !membership.isActive) {
        return false;
      }

      if (membership.joinedAt > occurredAt) {
        return false;
      }

      if (membership.leftAt && membership.leftAt < occurredAt) {
        return false;
      }

      return true;
    })
    .map((membership) => {
      const employee = employeeMap.get(membership.employeeId);
      if (!employee) {
        throw new PayrollCalculationError(
          `Pool membership references unknown employee ${membership.employeeId}`,
        );
      }

      return employee;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function addAllocation(
  aggregates: Map<string, EmployeeAggregate>,
  employee: PayrollEmployee,
  tipId: string,
  amountCents: number,
) {
  const current = aggregates.get(employee.id) ?? {
    employeeId: employee.id,
    employeeName: employee.name,
    grossTipsCents: 0,
    tipIds: new Set<string>(),
  };

  current.grossTipsCents += amountCents;
  current.tipIds.add(tipId);
  aggregates.set(employee.id, current);
}

function allocateRuleLines(amount: number, lines: PayrollAllocationRuleLine[]) {
  const totalCents = amountToCents(amount);
  const allocations = new Map<string, number>();
  const provisional = lines.map((line) => {
    const raw = (totalCents * line.percentageBps) / BASIS_POINTS_TOTAL;
    const floorAmount = Math.floor(raw);
    return {
      lineId: line.id,
      floorAmount,
      remainder: raw - floorAmount,
    };
  });

  provisional.forEach((entry) => {
    allocations.set(entry.lineId, entry.floorAmount);
  });

  let remainingCents =
    totalCents - provisional.reduce((total, entry) => total + entry.floorAmount, 0);

  provisional
    .slice()
    .sort((left, right) => {
      if (right.remainder !== left.remainder) {
        return right.remainder - left.remainder;
      }

      return left.lineId.localeCompare(right.lineId);
    })
    .forEach((entry) => {
      if (remainingCents <= 0) {
        return;
      }

      allocations.set(entry.lineId, (allocations.get(entry.lineId) ?? 0) + 1);
      remainingCents -= 1;
    });

  return allocations;
}

function splitEvenlyCents(totalCents: number, count: number) {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;

  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function amountToCents(amount: number) {
  return Math.round(amount * 100);
}

function centsToAmount(cents: number) {
  return Number((cents / 100).toFixed(2));
}
