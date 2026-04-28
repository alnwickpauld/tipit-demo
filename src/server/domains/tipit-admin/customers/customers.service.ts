import { SettlementFrequency } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { upsertPayrollCalendar } from "../../../../lib/payroll-calendar";
import { prisma } from "../../../../lib/prisma";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  UpdateCustomerStatusInput,
} from "./customers.schemas";

function percentToBps(percent: number) {
  return Math.round(percent * 100);
}

function inferCalendarDefaults(payrollFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY") {
  switch (payrollFrequency) {
    case "WEEKLY":
      return { periodsPerYear: 52, periodLengthDays: 7 };
    case "FORTNIGHTLY":
      return { periodsPerYear: 26, periodLengthDays: 14 };
    case "MONTHLY":
      return { periodsPerYear: 13, periodLengthDays: 28 };
  }
}

function mapCustomerResponse(
  customer: Awaited<ReturnType<CustomersService["loadCustomerOrThrow"]>>,
) {
  return {
    id: customer.id,
    name: customer.name,
    slug: customer.slug,
    legalName: customer.legalName,
    billingEmail: customer.contactEmail,
    contactPhone: customer.contactPhone,
    status: customer.status,
    tipitFeePercent: customer.tipitFeeBps / 100,
    payrollFrequency: customer.payrollConfig?.frequency ?? null,
    payrollAnchorDate: customer.payrollConfig?.payPeriodAnchor ?? null,
    payrollCalendarStartDate: customer.payrollCalendar?.startDate ?? null,
    periodsPerYear: customer.payrollCalendar?.periodsPerYear ?? null,
    periodLengthDays: customer.payrollCalendar?.periodLengthDays ?? null,
    startDayOfWeek: customer.payrollCalendar?.startDayOfWeek ?? null,
    settlementFrequency:
      customer.payrollConfig?.settlementFrequency ?? SettlementFrequency.WEEKLY,
    currency: customer.currency,
    timezone: customer.timezone,
    venueCount: customer._count.venues,
    customerUserCount: customer._count.customerUsers,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export class CustomersService {
  constructor(
    private readonly db: Pick<
      PrismaClient,
      "customer" | "payrollConfig" | "payrollCalendar" | "$transaction"
    > = prisma,
  ) {}

  async list() {
    const customers = await this.db.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        payrollConfig: true,
        payrollCalendar: true,
        _count: {
          select: {
            venues: true,
            customerUsers: true,
          },
        },
      },
    });

    return customers.map(mapCustomerResponse);
  }

  async getById(customerId: string) {
    return mapCustomerResponse(await this.loadCustomerOrThrow(customerId));
  }

  async create(input: CreateCustomerInput) {
    const customer = await this.db.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          name: input.name,
          slug: input.slug,
          legalName: input.legalName,
          contactEmail: input.billingEmail,
          contactPhone: input.contactPhone,
          status: input.status,
          tipitFeeBps: percentToBps(input.tipitFeePercent),
          currency: input.currency,
          timezone: input.timezone,
        },
      });

      const defaults = inferCalendarDefaults(input.payrollFrequency);
      const calendarAnchor = input.payrollCalendarStartDate ?? input.payrollAnchorDate ?? new Date();
      const payrollCalendar = await upsertPayrollCalendar(
        created.id,
        {
          startDate: calendarAnchor,
          startDayOfWeek: input.startDayOfWeek ?? calendarAnchor.getUTCDay(),
          periodsPerYear: input.periodsPerYear ?? defaults.periodsPerYear,
          periodLengthDays: input.periodLengthDays ?? defaults.periodLengthDays,
          timezone: input.timezone,
        },
        tx,
      );

      await tx.payrollConfig.create({
        data: {
          customerId: created.id,
          frequency: input.payrollFrequency,
          payPeriodAnchor: input.payrollAnchorDate ?? input.payrollCalendarStartDate,
          settlementFrequency: input.settlementFrequency,
          payrollCalendarId: payrollCalendar.id,
        },
      });

      return created.id;
    });

    return this.getById(customer);
  }

  async update(customerId: string, input: UpdateCustomerInput) {
    const existing = await this.loadCustomerOrThrow(customerId);

    await this.db.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          name: input.name,
          slug: input.slug,
          legalName: input.legalName,
          contactEmail: input.billingEmail,
          contactPhone: input.contactPhone,
          status: input.status,
          tipitFeeBps:
            input.tipitFeePercent === undefined ? undefined : percentToBps(input.tipitFeePercent),
          currency: input.currency,
          timezone: input.timezone,
        },
      });

      if (
        input.payrollFrequency !== undefined ||
        input.payrollAnchorDate !== undefined ||
        input.settlementFrequency !== undefined ||
        input.payrollCalendarStartDate !== undefined ||
        input.periodsPerYear !== undefined ||
        input.periodLengthDays !== undefined ||
        input.startDayOfWeek !== undefined ||
        input.timezone !== undefined
      ) {
        const defaults = inferCalendarDefaults(
          input.payrollFrequency ?? existing.payrollConfig?.frequency ?? "FORTNIGHTLY",
        );
        const calendarAnchor =
          input.payrollCalendarStartDate ??
          input.payrollAnchorDate ??
          existing.payrollCalendar?.startDate ??
          existing.payrollConfig?.payPeriodAnchor ??
          new Date();
        const payrollCalendar = await upsertPayrollCalendar(
          customerId,
          {
            startDate: calendarAnchor,
            startDayOfWeek:
              input.startDayOfWeek ??
              existing.payrollCalendar?.startDayOfWeek ??
              calendarAnchor.getUTCDay(),
            periodsPerYear:
              input.periodsPerYear ?? existing.payrollCalendar?.periodsPerYear ?? defaults.periodsPerYear,
            periodLengthDays:
              input.periodLengthDays ??
              existing.payrollCalendar?.periodLengthDays ??
              defaults.periodLengthDays,
            timezone: input.timezone ?? existing.timezone,
          },
          tx,
        );

        await tx.payrollConfig.upsert({
          where: { customerId },
          create: {
            customerId,
            frequency: input.payrollFrequency ?? "WEEKLY",
            payPeriodAnchor: input.payrollAnchorDate ?? input.payrollCalendarStartDate,
            settlementFrequency: input.settlementFrequency ?? SettlementFrequency.WEEKLY,
            payrollCalendarId: payrollCalendar.id,
          },
          update: {
            frequency: input.payrollFrequency,
            payPeriodAnchor:
              input.payrollAnchorDate ?? input.payrollCalendarStartDate ?? undefined,
            settlementFrequency: input.settlementFrequency,
            payrollCalendarId: payrollCalendar.id,
          },
        });
      }
    });

    return this.getById(customerId);
  }

  async updateStatus(customerId: string, input: UpdateCustomerStatusInput) {
    await this.loadCustomerOrThrow(customerId);

    await this.db.customer.update({
      where: { id: customerId },
      data: { status: input.status },
    });

    return this.getById(customerId);
  }

  private async loadCustomerOrThrow(customerId: string) {
    const customer = await this.db.customer.findUnique({
      where: { id: customerId },
      include: {
        payrollConfig: true,
        payrollCalendar: true,
        _count: {
          select: {
            venues: true,
            customerUsers: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    return customer;
  }
}
