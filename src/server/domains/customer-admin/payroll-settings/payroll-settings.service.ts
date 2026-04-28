import { prisma } from "../../../../lib/prisma";
import { upsertPayrollCalendar } from "../../../../lib/payroll-calendar";
import { NotFoundError } from "../../../shared/errors/app-error";

export class PayrollSettingsService {
  async get(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        payrollConfig: {
          include: {
            payrollCalendar: true,
          },
        },
        payrollCalendar: true,
        timezone: true,
        currency: true,
      },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    return customer;
  }

  async update(
      customerId: string,
      input: Partial<{
        frequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
        settlementFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
        payPeriodAnchor: Date;
        payrollCalendarStartDate: Date;
        periodsPerYear: number;
        periodLengthDays: number;
        startDayOfWeek: number;
        settlementDay: number;
        exportEmail: string;
        notes: string;
        timezone: string;
        currency: string;
    }>,
  ) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        timezone: true,
        payrollCalendar: true,
        payrollConfig: {
          include: {
            payrollCalendar: true,
          },
        },
      },
    });
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const {
      timezone,
      currency,
      payrollCalendarStartDate,
      periodsPerYear,
      periodLengthDays,
      startDayOfWeek,
      ...payrollConfigInput
    } = input;

    return prisma.$transaction(async (tx) => {
      const effectiveTimezone = timezone ?? customer.timezone;
      const baseAnchor = payrollCalendarStartDate ?? payrollConfigInput.payPeriodAnchor ?? customer.payrollConfig?.payPeriodAnchor ?? new Date();
      const calendar = await upsertPayrollCalendar(
        customerId,
        {
          startDate: baseAnchor,
          startDayOfWeek: startDayOfWeek ?? new Date(baseAnchor).getUTCDay(),
          periodsPerYear: periodsPerYear ?? customer.payrollCalendar?.periodsPerYear ?? 13,
          periodLengthDays: periodLengthDays ?? customer.payrollCalendar?.periodLengthDays ?? 28,
          timezone: effectiveTimezone,
        },
        tx,
      );

      await tx.customer.update({
        where: { id: customerId },
        data: {
          timezone,
          currency,
          payrollCalendar: {
            connect: {
              id: calendar.id,
            },
          },
          payrollConfig: {
            upsert: {
              create: {
                frequency: payrollConfigInput.frequency ?? "WEEKLY",
                settlementFrequency: payrollConfigInput.settlementFrequency ?? "WEEKLY",
                payPeriodAnchor: payrollConfigInput.payPeriodAnchor ?? payrollCalendarStartDate,
                settlementDay: payrollConfigInput.settlementDay,
                exportEmail: payrollConfigInput.exportEmail,
                notes: payrollConfigInput.notes,
                payrollCalendarId: calendar.id,
              },
              update: {
                ...payrollConfigInput,
                payPeriodAnchor:
                  payrollConfigInput.payPeriodAnchor ?? payrollCalendarStartDate ?? undefined,
                payrollCalendarId: calendar.id,
              },
            },
          },
        },
      });

      return tx.customer.findUniqueOrThrow({
        where: { id: customerId },
        select: {
          id: true,
          name: true,
          payrollConfig: {
            include: {
              payrollCalendar: true,
            },
          },
          payrollCalendar: true,
          timezone: true,
          currency: true,
        },
      });
    });
  }
}
