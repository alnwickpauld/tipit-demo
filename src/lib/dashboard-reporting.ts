import { Prisma } from "@prisma/client";

import { getCurrentPayrollPeriod, getPeriodsInRange } from "./payroll-calendar";
import { prisma } from "./prisma";
import { PoolDistributionService } from "../services/pool-distribution-service";

export type RankingGranularity = "monthly" | "quarterly" | "yearly";

export type DashboardContext = {
  customerId: string;
  customerName: string;
  currency: string;
  venues: { id: string; name: string }[];
  payrollPeriods: {
    id: string;
    label: string;
    startDate: Date;
    endDate: Date;
  }[];
};

export type EmployeeEarningsRow = {
  employeeId: string;
  employeeName: string;
  payrollReference: string | null;
  grossTips: number;
  netTips: number;
  poolAllocation: number;
  totalPayrollAmount: number;
  hoursSources: string[];
  tipCount: number;
  averageTip: number;
  rank: number;
};

export type PoolSummaryRow = {
  poolId: string;
  poolName: string;
  grossTips: number;
  netTips: number;
  memberCount: number;
};

export type RevenueCentreBreakdownRow = {
  revenueCentreType: "RESTAURANT" | "BAR" | "MEETINGS_EVENTS" | "BREAKFAST" | "ROOM_SERVICE";
  grossTips: number;
  netTips: number;
  tipCount: number;
};

export type RankingRow = {
  employeeId: string;
  employeeName: string;
  total: number;
  averageRating: number;
  ratingCount: number;
  rank: number;
};

export type RankingBucket = {
  label: string;
  key: string;
  averageRating: number;
  ratingCount: number;
  rows: RankingRow[];
};

export type DashboardOverview = {
  totalGrossTips: number;
  totalNetTips: number;
  totalTipCount: number;
  activeEmployees: number;
  averageRating: number;
  topEarners: EmployeeEarningsRow[];
  poolBreakdown: PoolSummaryRow[];
  recentPayrollRows: EmployeeEarningsRow[];
  monthlyTrend: { label: string; grossTips: number }[];
  revenueCentreBreakdown: RevenueCentreBreakdownRow[];
};

export type PayrollReport = {
  context: DashboardContext;
  selectedVenueId: string | null;
  selectedPayrollPeriodId: string | null;
  selectedPeriodLabel: string;
  rows: EmployeeEarningsRow[];
  topEarners: EmployeeEarningsRow[];
  poolBreakdown: PoolSummaryRow[];
  revenueCentreBreakdown: RevenueCentreBreakdownRow[];
  tipOutSummary: {
    totalTransferred: number;
    postingCount: number;
    affectedStaffCount: number;
  };
  tipOutPools: Array<{
    poolId: string;
    poolName: string;
    poolType: string;
    totalTransferred: number;
    totalHoursWorked: number;
    perHourRate: number;
  }>;
  summary: {
    grossTips: number;
    netTips: number;
    poolAllocations: number;
    payrollTotal: number;
    tipCount: number;
    employeeCount: number;
  };
};

export type LeaderboardReport = {
  context: DashboardContext;
  selectedVenueId: string | null;
  selectedGranularity: RankingGranularity;
  selectedGranularityLabel: string;
  selectedRankingMode: "earnings" | "rating";
  buckets: RankingBucket[];
  latestBucket: RankingBucket | null;
};

type ReportingFilters = {
  venueId?: string | null;
  payrollPeriodId?: string | null;
  periodStart?: Date;
  periodEnd?: Date;
};

function toAmount(value: Prisma.Decimal | number | null | undefined) {
  return Number(value ?? 0);
}

function toGranularityLabel(granularity: RankingGranularity) {
  switch (granularity) {
    case "monthly":
      return "Payroll period";
    case "quarterly":
      return "Quarter";
    case "yearly":
      return "Year";
  }
}

function assignRanks<T extends { grossTips?: number; total?: number; averageRating?: number }>(
  rows: T[],
  metric: "grossTips" | "total" | "averageRating" = "grossTips",
) {
  let currentRank = 0;
  let previousValue: number | null = null;

  return rows.map((row, index) => {
    const currentValue =
      metric === "averageRating"
        ? row.averageRating ?? 0
        : metric === "total"
          ? row.total ?? 0
          : row.grossTips ?? 0;
    if (previousValue !== currentValue) {
      currentRank = index + 1;
      previousValue = currentValue;
    }

    return {
      ...row,
      rank: currentRank,
    };
  });
}

function buildPeriodFilter(options: ReportingFilters) {
  if (options.payrollPeriodId) {
    return { payrollPeriodId: options.payrollPeriodId };
  }

  if (options.periodStart && options.periodEnd) {
    return {
      tipTransaction: {
        occurredAt: {
          gte: options.periodStart,
          lte: options.periodEnd,
        },
      },
    };
  }

  return {};
}

export async function getDashboardContext(customerId: string): Promise<DashboardContext> {
  const [customer, payrollPeriods] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        venues: {
          where: { status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
    getPeriodsInRange(customerId, {
      startDate: new Date(new Date().getTime() - 370 * 24 * 60 * 60 * 1000),
      endDate: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000),
    }, { autoGenerate: false }),
  ]);

  if (!customer) {
    throw new Error("No customer data found. Seed the database first.");
  }

  return {
    customerId: customer.id,
    customerName: customer.name,
    currency: customer.currency,
    venues: customer.venues,
    payrollPeriods: payrollPeriods
      .slice(-12)
      .reverse()
      .map((period) => ({
        id: period.id,
        label:
          period.label ??
          `${period.startDate.toLocaleDateString("en-GB")} - ${period.endDate.toLocaleDateString("en-GB")}`,
        startDate: period.startDate,
        endDate: period.endDate,
      })),
  };
}

export async function getDashboardOverview(
  customerId: string,
  venueId?: string | null,
): Promise<DashboardOverview & { context: DashboardContext }> {
  const context = await getDashboardContext(customerId);
  const currentPeriod = await getCurrentPayrollPeriod(customerId, new Date(), { autoGenerate: false });
  const venueFilter = venueId ? { venueId } : {};

  const [employeeRows, poolBreakdown, monthlyTrend, revenueCentreBreakdown, summary, activeEmployees, ratingSummary] =
    await Promise.all([
      getEmployeeEarnings(customerId, venueId ? { venueId } : {}),
      getPoolBreakdown(customerId, venueId ? { venueId } : {}),
      getPayrollPeriodTrend(customerId, venueId, currentPeriod?.endDate ?? new Date()),
      getRevenueCentreBreakdown(customerId, venueId ? { venueId } : {}),
      prisma.allocationResult.aggregate({
        where: {
          customerId,
          ...venueFilter,
        },
        _sum: {
          grossAmount: true,
          netAmount: true,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.staffMember.count({
        where: {
          customerId,
          ...(venueId ? { venueId } : {}),
          status: "ACTIVE",
        },
      }),
      prisma.tipTransaction.aggregate({
        where: {
          customerId,
          status: "SUCCEEDED",
          rating: { not: null },
          ...(venueId ? { venueId } : {}),
        },
        _avg: {
          rating: true,
        },
      }),
    ]);

  return {
    context,
    totalGrossTips: toAmount(summary._sum.grossAmount),
    totalNetTips: toAmount(summary._sum.netAmount),
    totalTipCount: summary._count._all,
    activeEmployees,
    averageRating: Number(ratingSummary._avg.rating ?? 0),
    topEarners: employeeRows.slice(0, 5),
    poolBreakdown,
    recentPayrollRows: employeeRows.slice(0, 8),
    monthlyTrend,
    revenueCentreBreakdown,
  };
}

export async function getPayrollReport(
  customerId: string,
  filters: { venueId?: string | null; payrollPeriodId?: string | null } = {},
): Promise<PayrollReport> {
  const context = await getDashboardContext(customerId);
  const selectedPeriod = filters.payrollPeriodId
    ? context.payrollPeriods.find((period) => period.id === filters.payrollPeriodId) ?? null
    : (await getCurrentPayrollPeriod(customerId, new Date(), { autoGenerate: false })) ??
      context.payrollPeriods[0] ??
      null;

  const queryOptions: ReportingFilters = {
    venueId: filters.venueId ?? null,
    payrollPeriodId: selectedPeriod?.id ?? null,
    periodStart: selectedPeriod?.startDate,
    periodEnd: selectedPeriod?.endDate,
  };

  const [employeeRows, poolBreakdown, revenueCentreBreakdown, tipCount] = await Promise.all([
    getEmployeeEarnings(customerId, queryOptions),
    getPoolBreakdown(customerId, queryOptions),
    getRevenueCentreBreakdown(customerId, queryOptions),
    getDistinctTipCount(customerId, queryOptions),
  ]);
  const poolAllocationRows = selectedPeriod
    ? await getPayrollPoolAllocations(customerId, {
        venueId: filters.venueId ?? null,
        payrollPeriodId: selectedPeriod.id,
      })
    : [];
  const tipOutReporting = selectedPeriod
    ? await getTipOutReporting(customerId, {
        venueId: filters.venueId ?? null,
        payrollPeriodId: selectedPeriod.id,
        periodStart: selectedPeriod.startDate,
        periodEnd: selectedPeriod.endDate,
      })
    : {
        totalTransferred: 0,
        postingCount: 0,
        affectedStaffCount: 0,
        pools: [],
      };

  const rowMap = new Map(employeeRows.map((row) => [row.employeeId, { ...row }]));
  for (const allocation of poolAllocationRows) {
    const existing = rowMap.get(allocation.employeeId);
    if (existing) {
      existing.poolAllocation = allocation.poolAllocation;
      existing.totalPayrollAmount = Number((existing.netTips + allocation.poolAllocation).toFixed(2));
      existing.payrollReference = allocation.payrollReference;
      existing.hoursSources = allocation.hoursSources;
      continue;
    }

    rowMap.set(allocation.employeeId, {
      employeeId: allocation.employeeId,
      employeeName: allocation.employeeName,
      payrollReference: allocation.payrollReference,
      grossTips: 0,
      netTips: 0,
      poolAllocation: allocation.poolAllocation,
      totalPayrollAmount: allocation.poolAllocation,
      hoursSources: allocation.hoursSources,
      tipCount: 0,
      averageTip: 0,
      rank: 0,
    });
  }

  const mergedRows = assignRanks(
    Array.from(rowMap.values()).sort((left, right) => {
      if (right.totalPayrollAmount !== left.totalPayrollAmount) {
        return right.totalPayrollAmount - left.totalPayrollAmount;
      }

      return left.employeeName.localeCompare(right.employeeName);
    }),
  ) as EmployeeEarningsRow[];

  const summary = mergedRows.reduce(
    (accumulator, row) => {
      accumulator.grossTips += row.grossTips;
      accumulator.netTips += row.netTips;
      accumulator.poolAllocations += row.poolAllocation;
      accumulator.payrollTotal += row.totalPayrollAmount;
      return accumulator;
    },
    {
      grossTips: 0,
      netTips: 0,
      poolAllocations: 0,
      payrollTotal: 0,
      tipCount,
      employeeCount: mergedRows.length,
    },
  );

  return {
    context,
    selectedVenueId: filters.venueId ?? null,
    selectedPayrollPeriodId: selectedPeriod?.id ?? null,
    selectedPeriodLabel: selectedPeriod?.label ?? "Current reporting range",
    rows: mergedRows,
    topEarners: mergedRows.slice(0, 5),
    poolBreakdown,
    revenueCentreBreakdown,
    tipOutSummary: {
      totalTransferred: tipOutReporting.totalTransferred,
      postingCount: tipOutReporting.postingCount,
      affectedStaffCount: tipOutReporting.affectedStaffCount,
    },
    tipOutPools: tipOutReporting.pools,
    summary,
  };
}

export async function getLeaderboardReport(
  customerId: string,
  options?: {
    venueId?: string | null;
    granularity?: RankingGranularity;
    rankingMode?: "earnings" | "rating";
  },
): Promise<LeaderboardReport> {
  const context = await getDashboardContext(customerId);
  const selectedGranularity = options?.granularity ?? "monthly";
  const selectedRankingMode = options?.rankingMode ?? "earnings";

  const allocationResults = await prisma.allocationResult.findMany({
    where: {
      customerId,
      ...(options?.venueId ? { venueId: options.venueId } : {}),
    },
    include: {
      employee: {
        select: { id: true, displayName: true, firstName: true, lastName: true, payrollReference: true },
      },
      tipTransaction: {
        select: {
          id: true,
          occurredAt: true,
          rating: true,
          payrollPeriodId: true,
          payrollPeriod: {
            select: {
              id: true,
              label: true,
              startDate: true,
              endDate: true,
              year: true,
              periodNumber: true,
            },
          },
        },
      },
    },
    orderBy: {
      tipTransaction: {
        occurredAt: "desc",
      },
    },
  });

  const bucketsMap = new Map<
    string,
    {
      label: string;
      ratingTipIds: Set<string>;
      ratingTotal: number;
      ratingCount: number;
      rows: Map<
        string,
        {
          employeeId: string;
          employeeName: string;
          total: number;
          ratingTotal: number;
          ratingCount: number;
        }
      >;
    }
  >();

  for (const result of allocationResults) {
    const bucketKey = getBucketKey(result.tipTransaction, selectedGranularity);
    const bucketLabel = getBucketLabel(result.tipTransaction, selectedGranularity);
    const bucket = bucketsMap.get(bucketKey) ?? {
      label: bucketLabel,
      ratingTipIds: new Set<string>(),
      ratingTotal: 0,
      ratingCount: 0,
      rows: new Map(),
    };

    const employeeName =
      result.employee.displayName ?? `${result.employee.firstName} ${result.employee.lastName}`;

    const current = bucket.rows.get(result.employeeId) ?? {
      employeeId: result.employeeId,
      employeeName,
      total: 0,
      ratingTotal: 0,
      ratingCount: 0,
    };

    current.total += toAmount(result.netAmount);
    if (result.tipTransaction.rating) {
      current.ratingTotal += Number(result.tipTransaction.rating);
      current.ratingCount += 1;
      if (!bucket.ratingTipIds.has(result.tipTransaction.id)) {
        bucket.ratingTipIds.add(result.tipTransaction.id);
        bucket.ratingTotal += Number(result.tipTransaction.rating);
        bucket.ratingCount += 1;
      }
    }
    bucket.rows.set(result.employeeId, current);
    bucketsMap.set(bucketKey, bucket);
  }

  const buckets = Array.from(bucketsMap.entries())
    .sort(([left], [right]) => (left < right ? 1 : -1))
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      averageRating:
        bucket.ratingCount > 0 ? Number((bucket.ratingTotal / bucket.ratingCount).toFixed(2)) : 0,
      ratingCount: bucket.ratingCount,
      rows: assignRanks(
        Array.from(bucket.rows.values())
          .map((row) => ({
            employeeId: row.employeeId,
            employeeName: row.employeeName,
            total: Number(row.total.toFixed(2)),
            averageRating:
              row.ratingCount > 0 ? Number((row.ratingTotal / row.ratingCount).toFixed(2)) : 0,
            ratingCount: row.ratingCount,
          }))
          .sort((left, right) => {
            if (selectedRankingMode === "rating") {
              if (right.averageRating !== left.averageRating) {
                return right.averageRating - left.averageRating;
              }

              if (right.ratingCount !== left.ratingCount) {
                return right.ratingCount - left.ratingCount;
              }
            } else if (right.total !== left.total) {
              return right.total - left.total;
            }

            if (right.total !== left.total) {
              return right.total - left.total;
            }

            return left.employeeName.localeCompare(right.employeeName);
          }),
        selectedRankingMode === "rating" ? "averageRating" : "total",
      ) as RankingRow[],
    }));

  return {
    context,
    selectedVenueId: options?.venueId ?? null,
    selectedGranularity,
    selectedGranularityLabel: toGranularityLabel(selectedGranularity),
    selectedRankingMode,
    buckets,
    latestBucket: buckets[0] ?? null,
  };
}

export async function getPayrollExportRows(
  customerId: string,
  filters: { venueId?: string | null; payrollPeriodId?: string | null } = {},
) {
  const report = await getPayrollReport(customerId, filters);

  return report.rows.map((row) => ({
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    payrollReference: row.payrollReference,
    grossTips: row.grossTips,
    netTips: row.netTips,
    poolAllocation: row.poolAllocation,
    totalPayrollAmount: row.totalPayrollAmount,
    tipCount: row.tipCount,
    averageTip: row.averageTip,
    rank: row.rank,
    hoursSource: row.hoursSources.join(", "),
  }));
}

async function getEmployeeEarnings(customerId: string, options: ReportingFilters = {}) {
  const results = await prisma.allocationResult.findMany({
    where: {
      customerId,
      ...(options.venueId ? { venueId: options.venueId } : {}),
      ...buildPeriodFilter(options),
    },
    include: {
      employee: {
        select: { id: true, displayName: true, firstName: true, lastName: true, payrollReference: true },
      },
      tipTransaction: {
        select: { id: true },
      },
    },
  });

  const aggregateMap = new Map<
    string,
    {
      employeeId: string;
      employeeName: string;
      payrollReference: string | null;
      grossTips: number;
      netTips: number;
      tipIds: Set<string>;
    }
  >();

  for (const result of results) {
    const employeeName =
      result.employee.displayName ?? `${result.employee.firstName} ${result.employee.lastName}`;

    const current = aggregateMap.get(result.employeeId) ?? {
      employeeId: result.employeeId,
      employeeName,
      payrollReference: result.employee.payrollReference,
      grossTips: 0,
      netTips: 0,
      tipIds: new Set<string>(),
    };

    current.grossTips += toAmount(result.grossAmount);
    current.netTips += toAmount(result.netAmount);
    current.tipIds.add(result.tipTransaction.id);
    aggregateMap.set(result.employeeId, current);
  }

  const rows = Array.from(aggregateMap.values())
    .map((row) => ({
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      payrollReference: row.payrollReference,
      grossTips: Number(row.grossTips.toFixed(2)),
      netTips: Number(row.netTips.toFixed(2)),
      poolAllocation: 0,
      totalPayrollAmount: Number(row.netTips.toFixed(2)),
      hoursSources: [],
      tipCount: row.tipIds.size,
      averageTip: row.tipIds.size > 0 ? Number((row.grossTips / row.tipIds.size).toFixed(2)) : 0,
      rank: 0,
    }))
    .sort((left, right) => {
      if (right.grossTips !== left.grossTips) {
        return right.grossTips - left.grossTips;
      }

      return left.employeeName.localeCompare(right.employeeName);
    });

  return assignRanks(rows) as EmployeeEarningsRow[];
}

async function getPoolBreakdown(customerId: string, options: ReportingFilters = {}) {
  const results = await prisma.allocationResult.findMany({
    where: {
      customerId,
      poolId: { not: null },
      ...(options.venueId ? { venueId: options.venueId } : {}),
      ...buildPeriodFilter(options),
    },
    include: {
      pool: {
        select: {
          id: true,
          name: true,
          members: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      },
    },
  });

  const map = new Map<string, PoolSummaryRow>();

  for (const result of results) {
    if (!result.pool) {
      continue;
    }

    const current = map.get(result.pool.id) ?? {
      poolId: result.pool.id,
      poolName: result.pool.name,
      grossTips: 0,
      netTips: 0,
      memberCount: result.pool.members.length,
    };

    current.grossTips += toAmount(result.grossAmount);
    current.netTips += toAmount(result.netAmount);
    map.set(result.pool.id, current);
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      grossTips: Number(row.grossTips.toFixed(2)),
      netTips: Number(row.netTips.toFixed(2)),
    }))
    .sort((left, right) => right.grossTips - left.grossTips);
}

async function getRevenueCentreBreakdown(customerId: string, options: ReportingFilters = {}) {
  const transactions = await prisma.tipTransaction.findMany({
    where: {
      customerId,
      status: "SUCCEEDED",
      ...(options.venueId ? { venueId: options.venueId } : {}),
      ...(options.payrollPeriodId
        ? { payrollPeriodId: options.payrollPeriodId }
        : options.periodStart && options.periodEnd
          ? {
              occurredAt: {
                gte: options.periodStart,
                lte: options.periodEnd,
              },
            }
          : {}),
    },
    select: {
      id: true,
      grossAmount: true,
      netAmount: true,
      destinationServiceArea: {
        select: {
          department: {
            select: {
              revenueCentreType: true,
            },
          },
        },
      },
    },
  });

  const map = new Map<RevenueCentreBreakdownRow["revenueCentreType"], RevenueCentreBreakdownRow>();

  for (const transaction of transactions) {
    const revenueCentreType =
      transaction.destinationServiceArea?.department.revenueCentreType ?? "RESTAURANT";
    const current = map.get(revenueCentreType) ?? {
      revenueCentreType,
      grossTips: 0,
      netTips: 0,
      tipCount: 0,
    };

    current.grossTips += toAmount(transaction.grossAmount);
    current.netTips += toAmount(transaction.netAmount);
    current.tipCount += 1;
    map.set(revenueCentreType, current);
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      grossTips: Number(row.grossTips.toFixed(2)),
      netTips: Number(row.netTips.toFixed(2)),
    }))
    .sort((left, right) => right.grossTips - left.grossTips);
}

async function getPayrollPeriodTrend(customerId: string, venueId: string | null | undefined, referenceDate: Date) {
  const periods = await getPeriodsInRange(customerId, {
    startDate: new Date(referenceDate.getTime() - 220 * 24 * 60 * 60 * 1000),
    endDate: referenceDate,
  }, { autoGenerate: false });

  const trendPeriods = periods.slice(-6);
  if (trendPeriods.length === 0) {
    return [];
  }

  const periodIds = trendPeriods.map((period) => period.id);
  const transactions = await prisma.tipTransaction.findMany({
    where: {
      customerId,
      status: "SUCCEEDED",
      payrollPeriodId: { in: periodIds },
      ...(venueId ? { venueId } : {}),
    },
    select: {
      payrollPeriodId: true,
      grossAmount: true,
    },
  });

  const totalsByPeriodId = new Map<string, number>();

  for (const transaction of transactions) {
    if (!transaction.payrollPeriodId) {
      continue;
    }

    totalsByPeriodId.set(
      transaction.payrollPeriodId,
      (totalsByPeriodId.get(transaction.payrollPeriodId) ?? 0) + toAmount(transaction.grossAmount),
    );
  }

  return trendPeriods.map((period) => ({
    label: period.label,
    grossTips: Number((totalsByPeriodId.get(period.id) ?? 0).toFixed(2)),
  }));
}

async function getDistinctTipCount(customerId: string, options: ReportingFilters = {}) {
  return prisma.tipTransaction.count({
    where: {
      customerId,
      status: "SUCCEEDED",
      ...(options.venueId ? { venueId: options.venueId } : {}),
      ...(options.payrollPeriodId
        ? { payrollPeriodId: options.payrollPeriodId }
        : options.periodStart && options.periodEnd
          ? {
              occurredAt: {
                gte: options.periodStart,
                lte: options.periodEnd,
              },
            }
          : {}),
    },
  });
}

async function getPayrollPoolAllocations(
  customerId: string,
  options: { venueId?: string | null; payrollPeriodId: string },
) {
  const allocations = await prisma.poolDistributionAllocation.findMany({
    where: {
      customerId,
      payrollPeriodId: options.payrollPeriodId,
      ...(options.venueId ? { venueId: options.venueId } : {}),
      run: {
        status: { in: ["LOCKED", "EXPORTED"] },
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          payrollReference: true,
        },
      },
    },
  });

  const map = new Map<
    string,
    {
      employeeId: string;
      employeeName: string;
      payrollReference: string | null;
      poolAllocation: number;
      hoursSources: Set<string>;
    }
  >();

  for (const allocation of allocations) {
    const employeeName =
      allocation.employee.displayName ??
      `${allocation.employee.firstName} ${allocation.employee.lastName}`.trim();
    const current = map.get(allocation.employeeId) ?? {
      employeeId: allocation.employeeId,
      employeeName,
      payrollReference: allocation.employee.payrollReference,
      poolAllocation: 0,
      hoursSources: new Set<string>(),
    };

    current.poolAllocation += toAmount(allocation.allocationAmount);
    current.hoursSources.add(allocation.hoursSource);
    map.set(allocation.employeeId, current);
  }

  return Array.from(map.values()).map((row) => ({
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    payrollReference: row.payrollReference,
    poolAllocation: Number(row.poolAllocation.toFixed(2)),
    hoursSources: Array.from(row.hoursSources.values()).sort(),
  }));
}

async function getTipOutReporting(customerId: string, options: Required<ReportingFilters>) {
  const distributionService = new PoolDistributionService();
  const postings = await prisma.tipOutPosting.findMany({
    where: {
      customerId,
      payrollPeriodId: options.payrollPeriodId,
      ...(options.venueId ? { venueId: options.venueId } : {}),
    },
    include: {
      targetPool: {
        select: {
          id: true,
          name: true,
          poolType: true,
          venueId: true,
        },
      },
    },
  });

  if (postings.length === 0) {
    return {
      totalTransferred: 0,
      postingCount: 0,
      affectedStaffCount: 0,
      pools: [] as Array<{
        poolId: string;
        poolName: string;
        poolType: string;
        totalTransferred: number;
        totalHoursWorked: number;
        perHourRate: number;
      }>,
    };
  }

  const poolMap = new Map<
    string,
    {
      poolId: string;
      poolName: string;
      poolType: string;
      venueId: string;
      totalTransferred: number;
    }
  >();
  const affectedStaffIds = new Set<string>();

  for (const posting of postings) {
    affectedStaffIds.add(posting.staffMemberId);
    const current = poolMap.get(posting.targetPoolId) ?? {
      poolId: posting.targetPoolId,
      poolName: posting.targetPool.name,
      poolType: posting.targetPool.poolType,
      venueId: posting.targetPool.venueId,
      totalTransferred: 0,
    };
    current.totalTransferred += Number(posting.tipOutAmount);
    poolMap.set(posting.targetPoolId, current);
  }

  const poolIds = Array.from(poolMap.keys());
  const [members, importedHours] = await Promise.all([
    prisma.poolMember.findMany({
      where: {
        poolId: { in: poolIds },
        joinedAt: { lte: options.periodEnd },
        OR: [{ leftAt: null }, { leftAt: { gte: options.periodStart } }],
      },
      include: {
        staffMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    }),
    prisma.importedHoursWorked.findMany({
      where: {
        customerId,
        workDate: {
          gte: options.periodStart,
          lte: options.periodEnd,
        },
        ...(options.venueId ? { venueId: options.venueId } : {}),
      },
      select: {
        venueId: true,
        staffMemberId: true,
        hoursWorked: true,
      },
    }),
  ]);

  const hoursByVenueAndStaff = new Map<string, number>();
  for (const row of importedHours) {
    if (!row.staffMemberId) {
      continue;
    }
    const key = `${row.venueId}:${row.staffMemberId}`;
    hoursByVenueAndStaff.set(key, Number(((hoursByVenueAndStaff.get(key) ?? 0) + Number(row.hoursWorked)).toFixed(4)));
  }

  const membersByPool = new Map<string, typeof members>();
  for (const member of members) {
    const current = membersByPool.get(member.poolId) ?? [];
    current.push(member);
    membersByPool.set(member.poolId, current);
  }

  const pools = Array.from(poolMap.values())
    .map((pool) => {
      const poolMembers = membersByPool.get(pool.poolId) ?? [];
      const distribution = distributionService.calculateDistribution({
        poolTotal: Number(pool.totalTransferred.toFixed(2)),
        staff: poolMembers.map((member) => ({
          staffMemberId: member.staffMember.id,
          employeeName:
            member.staffMember.displayName ??
            `${member.staffMember.firstName} ${member.staffMember.lastName}`.trim(),
          hoursWorked: hoursByVenueAndStaff.get(`${pool.venueId}:${member.staffMember.id}`) ?? 0,
        })),
      });

      return {
        poolId: pool.poolId,
        poolName: pool.poolName,
        poolType: pool.poolType,
        totalTransferred: Number(pool.totalTransferred.toFixed(2)),
        totalHoursWorked: distribution.totalHoursWorked,
        perHourRate: distribution.perHourRate,
      };
    })
    .sort((left, right) => right.totalTransferred - left.totalTransferred);

  return {
    totalTransferred: Number(postings.reduce((sum, posting) => sum + Number(posting.tipOutAmount), 0).toFixed(2)),
    postingCount: postings.length,
    affectedStaffCount: affectedStaffIds.size,
    pools,
  };
}

function getBucketKey(
  transaction: {
    occurredAt: Date;
    payrollPeriodId: string | null;
    payrollPeriod: {
      id: string;
      label: string | null;
      startDate: Date;
      endDate: Date;
      year: number;
      periodNumber: number;
    } | null;
  },
  granularity: RankingGranularity,
) {
  if (granularity === "monthly" && transaction.payrollPeriodId && transaction.payrollPeriod) {
    return `period-${transaction.payrollPeriodId}`;
  }

  const date = transaction.payrollPeriod?.endDate ?? transaction.occurredAt;
  const year = date.getUTCFullYear();

  if (granularity === "yearly") {
    return `${year}`;
  }

  if (granularity === "quarterly") {
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    return `${year}-Q${quarter}`;
  }

  return `${year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getBucketLabel(
  transaction: {
    occurredAt: Date;
    payrollPeriodId: string | null;
    payrollPeriod: {
      id: string;
      label: string | null;
      startDate: Date;
      endDate: Date;
      year: number;
      periodNumber: number;
    } | null;
  },
  granularity: RankingGranularity,
) {
  if (granularity === "monthly" && transaction.payrollPeriod) {
    return (
      transaction.payrollPeriod.label ??
      `P${String(transaction.payrollPeriod.periodNumber).padStart(2, "0")} ${transaction.payrollPeriod.year}`
    );
  }

  const date = transaction.payrollPeriod?.endDate ?? transaction.occurredAt;
  const year = date.getUTCFullYear();

  if (granularity === "yearly") {
    return `${year}`;
  }

  if (granularity === "quarterly") {
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    return `Q${quarter} ${year}`;
  }

  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
