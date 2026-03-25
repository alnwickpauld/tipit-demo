import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

export type RankingGranularity = "monthly" | "quarterly" | "yearly";

export type DashboardContext = {
  customerId: string;
  customerName: string;
  currency: string;
  venues: { id: string; name: string }[];
  payrollPeriods: {
    id: string;
    label: string;
    startsAt: Date;
    endsAt: Date;
  }[];
};

export type EmployeeEarningsRow = {
  employeeId: string;
  employeeName: string;
  grossTips: number;
  netTips: number;
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
};

export type PayrollReport = {
  context: DashboardContext;
  selectedVenueId: string | null;
  selectedPayrollPeriodId: string | null;
  selectedPeriodLabel: string;
  rows: EmployeeEarningsRow[];
  topEarners: EmployeeEarningsRow[];
  poolBreakdown: PoolSummaryRow[];
  summary: {
    grossTips: number;
    netTips: number;
    tipCount: number;
    employeeCount: number;
  };
};

export type LeaderboardReport = {
  context: DashboardContext;
  selectedVenueId: string | null;
  selectedGranularity: RankingGranularity;
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
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      venues: {
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
      payrollPeriods: {
        orderBy: [{ startsAt: "desc" }],
        take: 12,
        select: { id: true, label: true, startsAt: true, endsAt: true },
      },
    },
  });

  if (!customer) {
    throw new Error("No customer data found. Seed the database first.");
  }

  return {
    customerId: customer.id,
    customerName: customer.name,
    currency: customer.currency,
    venues: customer.venues,
    payrollPeriods: customer.payrollPeriods.map((period) => ({
      id: period.id,
      label:
        period.label ??
        `${period.startsAt.toLocaleDateString("en-GB")} - ${period.endsAt.toLocaleDateString("en-GB")}`,
      startsAt: period.startsAt,
      endsAt: period.endsAt,
    })),
  };
}

export async function getDashboardOverview(
  customerId: string,
  venueId?: string | null,
): Promise<DashboardOverview & { context: DashboardContext }> {
  const context = await getDashboardContext(customerId);
  const venueFilter = venueId ? { venueId } : {};

  const [employeeRows, poolBreakdown, monthlyTrend, summary, activeEmployees, ratingSummary] =
    await Promise.all([
      getEmployeeEarnings(customerId, venueId ? { venueId } : {}),
      getPoolBreakdown(customerId, venueId ? { venueId } : {}),
      getMonthlyTrend(customerId, venueId),
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
  };
}

export async function getPayrollReport(
  customerId: string,
  filters: { venueId?: string | null; payrollPeriodId?: string | null } = {},
): Promise<PayrollReport> {
  const context = await getDashboardContext(customerId);
  const selectedPeriod = filters.payrollPeriodId
    ? context.payrollPeriods.find((period) => period.id === filters.payrollPeriodId) ?? null
    : context.payrollPeriods[0] ?? null;

  const queryOptions: ReportingFilters = {
    venueId: filters.venueId ?? null,
    payrollPeriodId: selectedPeriod?.id ?? null,
    periodStart: selectedPeriod?.startsAt,
    periodEnd: selectedPeriod?.endsAt,
  };

  const [employeeRows, poolBreakdown, tipCount] = await Promise.all([
    getEmployeeEarnings(customerId, queryOptions),
    getPoolBreakdown(customerId, queryOptions),
    getDistinctTipCount(customerId, queryOptions),
  ]);

  const summary = employeeRows.reduce(
    (accumulator, row) => {
      accumulator.grossTips += row.grossTips;
      accumulator.netTips += row.netTips;
      return accumulator;
    },
    {
      grossTips: 0,
      netTips: 0,
      tipCount,
      employeeCount: employeeRows.length,
    },
  );

  return {
    context,
    selectedVenueId: filters.venueId ?? null,
    selectedPayrollPeriodId: selectedPeriod?.id ?? null,
    selectedPeriodLabel: selectedPeriod?.label ?? "Current reporting range",
    rows: employeeRows,
    topEarners: employeeRows.slice(0, 5),
    poolBreakdown,
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
        select: { id: true, displayName: true, firstName: true, lastName: true },
      },
      tipTransaction: {
        select: { id: true, occurredAt: true, rating: true },
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
    const occurredAt = result.tipTransaction.occurredAt;
    const bucketKey = getBucketKey(occurredAt, selectedGranularity);
    const bucketLabel = getBucketLabel(occurredAt, selectedGranularity);
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
    selectedRankingMode,
    buckets,
    latestBucket: buckets[0] ?? null,
  };
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
        select: { id: true, displayName: true, firstName: true, lastName: true },
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
      grossTips: Number(row.grossTips.toFixed(2)),
      netTips: Number(row.netTips.toFixed(2)),
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

async function getMonthlyTrend(customerId: string, venueId?: string | null) {
  const transactions = await prisma.tipTransaction.findMany({
    where: {
      customerId,
      status: "SUCCEEDED",
      ...(venueId ? { venueId } : {}),
    },
    orderBy: { occurredAt: "asc" },
    select: {
      occurredAt: true,
      grossAmount: true,
    },
  });

  const buckets = new Map<string, { label: string; grossTips: number }>();

  for (const transaction of transactions) {
    const date = transaction.occurredAt;
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

    const current = buckets.get(key) ?? { label, grossTips: 0 };
    current.grossTips += toAmount(transaction.grossAmount);
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => (left > right ? 1 : -1))
    .slice(-6)
    .map(([, value]) => ({
      label: value.label,
      grossTips: Number(value.grossTips.toFixed(2)),
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

function getBucketKey(date: Date, granularity: RankingGranularity) {
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

function getBucketLabel(date: Date, granularity: RankingGranularity) {
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
