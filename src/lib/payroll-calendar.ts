import { PayrollFrequency, Prisma } from "@prisma/client";

import { prisma } from "./prisma";

const DEFAULT_GENERATION_BUFFER_DAYS = 420;

export type PayrollDateRange = {
  startDate: Date;
  endDate: Date;
};

export type PayrollCalendarSummary = {
  id: string;
  customerId: string;
  startDate: Date;
  startDayOfWeek: number;
  periodsPerYear: number;
  periodLengthDays: number;
  timezone: string;
};

export type PayrollPeriodSummary = {
  id: string;
  customerId: string;
  payrollCalendarId: string | null;
  label: string;
  year: number;
  periodNumber: number;
  startDate: Date;
  endDate: Date;
};

type PayrollPeriodLookupOptions = {
  autoGenerate?: boolean;
};

function startOfUtcDay(date: Date) {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function endOfPayrollDay(date: Date) {
  const next = new Date(date);
  next.setUTCHours(23, 59, 59, 999);
  return next;
}

function weekdayNumber(date: Date) {
  return startOfUtcDay(date).getUTCDay();
}

function clampStartDateToWeekday(startDate: Date, startDayOfWeek: number) {
  const normalized = startOfUtcDay(startDate);
  const shift = (startDayOfWeek - normalized.getUTCDay() + 7) % 7;
  return addDays(normalized, shift);
}

function inferCalendarDefaultsFromFrequency(frequency: PayrollFrequency | null | undefined) {
  switch (frequency) {
    case "WEEKLY":
      return { periodsPerYear: 52, periodLengthDays: 7 };
    case "FORTNIGHTLY":
      return { periodsPerYear: 26, periodLengthDays: 14 };
    case "MONTHLY":
      return { periodsPerYear: 12, periodLengthDays: 30 };
    default:
      return { periodsPerYear: 13, periodLengthDays: 28 };
  }
}

function buildPeriodLabel(periodYear: number, periodNumber: number) {
  return `P${String(periodNumber).padStart(2, "0")} ${periodYear}`;
}

function buildGeneratedPeriods(
  calendar: PayrollCalendarSummary,
  range: PayrollDateRange,
  frequency: PayrollFrequency,
) {
  const periods: Array<{
    customerId: string;
    payrollCalendarId: string;
    frequency: PayrollFrequency;
    label: string;
    year: number;
    periodNumber: number;
    startDate: Date;
    endDate: Date;
    startsAt: Date;
    endsAt: Date;
  }> = [];

  const calendarStart = startOfUtcDay(calendar.startDate);
  const safeRangeStart = startOfUtcDay(range.startDate);
  const safeRangeEnd = startOfUtcDay(range.endDate);
  const periodLengthDays = Math.max(1, calendar.periodLengthDays);

  const diffMs = safeRangeStart.getTime() - calendarStart.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const firstIndex = Math.max(0, Math.floor(diffDays / periodLengthDays) - 1);

  for (let index = firstIndex; index < firstIndex + 400; index += 1) {
    const startDate = addDays(calendarStart, index * periodLengthDays);
    const endDate = endOfPayrollDay(addDays(startDate, periodLengthDays - 1));

    if (startDate > safeRangeEnd) {
      break;
    }

    if (endDate < safeRangeStart) {
      continue;
    }

    const periodYear = calendarStart.getUTCFullYear() + Math.floor(index / calendar.periodsPerYear);
    const periodNumber = (index % calendar.periodsPerYear) + 1;

    periods.push({
      customerId: calendar.customerId,
      payrollCalendarId: calendar.id,
      frequency,
      label: buildPeriodLabel(periodYear, periodNumber),
      year: periodYear,
      periodNumber,
      startDate,
      endDate,
      startsAt: startDate,
      endsAt: endDate,
    });
  }

  return periods;
}

async function getOrCreatePayrollCalendar(
  customerId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      timezone: true,
      payrollCalendar: true,
      payrollConfig: {
        select: {
          id: true,
          frequency: true,
          payPeriodAnchor: true,
        },
      },
    },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  if (customer.payrollCalendar) {
    return {
      calendar: {
        ...customer.payrollCalendar,
      } satisfies PayrollCalendarSummary,
      frequency: customer.payrollConfig?.frequency ?? "FORTNIGHTLY",
    };
  }

  const inferred = inferCalendarDefaultsFromFrequency(customer.payrollConfig?.frequency);
  const anchor = customer.payrollConfig?.payPeriodAnchor ?? new Date();
  const normalizedStartDate = startOfUtcDay(anchor);
  const startDayOfWeek = weekdayNumber(normalizedStartDate);

  const calendar = await tx.payrollCalendar.create({
    data: {
      customerId,
      startDate: normalizedStartDate,
      startDayOfWeek,
      periodsPerYear: inferred.periodsPerYear,
      periodLengthDays: inferred.periodLengthDays,
      timezone: customer.timezone,
    },
  });

  if (customer.payrollConfig) {
    await tx.payrollConfig.update({
      where: { id: customer.payrollConfig.id },
      data: {
        payrollCalendarId: calendar.id,
      },
    });
  }

  return {
    calendar: calendar satisfies PayrollCalendarSummary,
    frequency: customer.payrollConfig?.frequency ?? "FORTNIGHTLY",
  };
}

export async function upsertPayrollCalendar(
  customerId: string,
  input: {
    startDate: Date;
    startDayOfWeek: number;
    periodsPerYear: number;
    periodLengthDays: number;
    timezone: string;
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const normalizedStartDate = clampStartDateToWeekday(input.startDate, input.startDayOfWeek);

  const calendar = await tx.payrollCalendar.upsert({
    where: { customerId },
    create: {
      customerId,
      startDate: normalizedStartDate,
      startDayOfWeek: input.startDayOfWeek,
      periodsPerYear: input.periodsPerYear,
      periodLengthDays: input.periodLengthDays,
      timezone: input.timezone,
    },
    update: {
      startDate: normalizedStartDate,
      startDayOfWeek: input.startDayOfWeek,
      periodsPerYear: input.periodsPerYear,
      periodLengthDays: input.periodLengthDays,
      timezone: input.timezone,
    },
  });

  await tx.payrollConfig.updateMany({
    where: { customerId },
    data: { payrollCalendarId: calendar.id },
  });

  return calendar;
}

export async function ensurePayrollPeriodsForRange(
  customerId: string,
  range: PayrollDateRange,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const { calendar, frequency } = await getOrCreatePayrollCalendar(customerId, tx);
  const bufferedRange = {
    startDate: addDays(range.startDate, -DEFAULT_GENERATION_BUFFER_DAYS),
    endDate: addDays(range.endDate, DEFAULT_GENERATION_BUFFER_DAYS),
  };

  const generatedPeriods = buildGeneratedPeriods(calendar, bufferedRange, frequency);
  const existingPeriods = await tx.payrollPeriod.findMany({
    where: {
      customerId,
      startDate: {
        gte: startOfUtcDay(bufferedRange.startDate),
        lte: startOfUtcDay(bufferedRange.endDate),
      },
    },
    select: {
      year: true,
      periodNumber: true,
    },
  });

  const existingKeys = new Set(
    existingPeriods.map((period) => `${period.year}-${period.periodNumber}`),
  );

  const missing = generatedPeriods.filter(
    (period) => !existingKeys.has(`${period.year}-${period.periodNumber}`),
  );

  if (missing.length > 0) {
    await tx.payrollPeriod.createMany({
      data: missing,
    });
  }

  return calendar;
}

export async function getCurrentPayrollPeriod(
  customerId: string,
  referenceDate = new Date(),
  options: PayrollPeriodLookupOptions = {},
) {
  if (options.autoGenerate ?? true) {
    await ensurePayrollPeriodsForRange(customerId, {
      startDate: referenceDate,
      endDate: referenceDate,
    });
  }

  const period = await prisma.payrollPeriod.findFirst({
    where: {
      customerId,
      startDate: { lte: referenceDate },
      endDate: { gte: referenceDate },
    },
    orderBy: { startDate: "desc" },
  });

  if (!period) {
    return null;
  }

  return {
    id: period.id,
    customerId: period.customerId,
    payrollCalendarId: period.payrollCalendarId,
    label: period.label ?? buildPeriodLabel(period.year, period.periodNumber),
    year: period.year,
    periodNumber: period.periodNumber,
    startDate: period.startDate,
    endDate: period.endDate,
  } satisfies PayrollPeriodSummary;
}

export async function getPeriodsInRange(
  customerId: string,
  dateRange: PayrollDateRange,
  options: PayrollPeriodLookupOptions = {},
) {
  if (options.autoGenerate ?? true) {
    await ensurePayrollPeriodsForRange(customerId, dateRange);
  }

  const periods = await prisma.payrollPeriod.findMany({
    where: {
      customerId,
      startDate: { lte: dateRange.endDate },
      endDate: { gte: dateRange.startDate },
    },
    orderBy: [{ startDate: "asc" }],
  });

  return periods.map(
    (period) =>
      ({
        id: period.id,
        customerId: period.customerId,
        payrollCalendarId: period.payrollCalendarId,
        label: period.label ?? buildPeriodLabel(period.year, period.periodNumber),
        year: period.year,
        periodNumber: period.periodNumber,
        startDate: period.startDate,
        endDate: period.endDate,
      }) satisfies PayrollPeriodSummary,
  );
}
