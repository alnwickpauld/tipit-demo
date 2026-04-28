import assert from "node:assert/strict";
import test from "node:test";

import { CustomersService } from "./customers.service";

const baseCustomerRecord = {
  id: "customer-1",
  name: "Shark Club UK",
  slug: "shark-club-uk",
  legalName: "Shark Club Newcastle Limited",
  contactEmail: "billing@sharkclub.example",
  contactPhone: "+44 191 555 0123",
  status: "ACTIVE" as const,
  tipitFeeBps: 500,
  currency: "GBP",
  timezone: "Europe/London",
  payrollConfig: {
    id: "payroll-1",
    customerId: "customer-1",
    frequency: "WEEKLY" as const,
    settlementFrequency: "WEEKLY" as const,
    payPeriodAnchor: new Date("2026-01-05T00:00:00.000Z"),
    settlementDay: null,
    exportEmail: null,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  _count: {
    venues: 2,
    customerUsers: 3,
  },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

test("create customer stores fee percent as basis points and creates payroll config", async () => {
  const calls: Array<{ step: string; data?: unknown }> = [];

  const service = new CustomersService({
    customer: {
      findMany: async () => [],
      findUnique: async () => baseCustomerRecord,
      create: async ({ data }: { data: unknown }) => {
        calls.push({ step: "customer.create", data });
        return { id: "customer-1" };
      },
      update: async () => baseCustomerRecord,
    },
    payrollConfig: {
      create: async ({ data }: { data: unknown }) => {
        calls.push({ step: "payrollConfig.create", data });
        return {};
      },
    },
    payrollCalendar: {
      upsert: async ({ data, create, update, where }: { data?: unknown; create?: unknown; update?: unknown; where?: unknown }) => {
        calls.push({
          step: "tx.payrollCalendar.upsert",
          data: data ?? { create, update, where },
        });
        return { id: "calendar-1" };
      },
    },
    $transaction: async (callback: (tx: unknown) => Promise<string>) =>
      callback({
        customer: {
          create: async ({ data }: { data: unknown }) => {
            calls.push({ step: "tx.customer.create", data });
            return { id: "customer-1" };
          },
        },
        payrollConfig: {
          create: async ({ data }: { data: unknown }) => {
            calls.push({ step: "tx.payrollConfig.create", data });
            return {};
          },
          updateMany: async ({ data }: { data: unknown }) => {
            calls.push({ step: "tx.payrollConfig.updateMany", data });
            return { count: 1 };
          },
        },
        payrollCalendar: {
          upsert: async ({ create, update, where }: { create: unknown; update: unknown; where: unknown }) => {
            calls.push({
              step: "tx.payrollCalendar.upsert",
              data: { create, update, where },
            });
            return { id: "calendar-1" };
          },
        },
      }),
  } as never);

  const result = await service.create({
    name: "Shark Club UK",
    slug: "shark-club-uk",
    legalName: "Shark Club Newcastle Limited",
    billingEmail: "billing@sharkclub.example",
    status: "ACTIVE",
    tipitFeePercent: 5,
    payrollFrequency: "WEEKLY",
    payrollAnchorDate: new Date("2026-01-05T00:00:00.000Z"),
    settlementFrequency: "WEEKLY",
    contactPhone: "+44 191 555 0123",
    currency: "GBP",
    timezone: "Europe/London",
  });

  assert.deepEqual(calls, [
    {
      step: "tx.customer.create",
      data: {
        name: "Shark Club UK",
        slug: "shark-club-uk",
        legalName: "Shark Club Newcastle Limited",
        contactEmail: "billing@sharkclub.example",
        contactPhone: "+44 191 555 0123",
        status: "ACTIVE",
        tipitFeeBps: 500,
        currency: "GBP",
        timezone: "Europe/London",
      },
    },
    {
      step: "tx.payrollCalendar.upsert",
      data: {
        where: {
          customerId: "customer-1",
        },
        create: {
          customerId: "customer-1",
          startDate: new Date("2026-01-05T00:00:00.000Z"),
          startDayOfWeek: 1,
          periodsPerYear: 52,
          periodLengthDays: 7,
          timezone: "Europe/London",
        },
        update: {
          startDate: new Date("2026-01-05T00:00:00.000Z"),
          startDayOfWeek: 1,
          periodsPerYear: 52,
          periodLengthDays: 7,
          timezone: "Europe/London",
        },
      },
    },
    {
      step: "tx.payrollConfig.updateMany",
      data: {
        payrollCalendarId: "calendar-1",
      },
    },
    {
      step: "tx.payrollConfig.create",
      data: {
        customerId: "customer-1",
        frequency: "WEEKLY",
        payPeriodAnchor: new Date("2026-01-05T00:00:00.000Z"),
        settlementFrequency: "WEEKLY",
        payrollCalendarId: "calendar-1",
      },
    },
  ]);

  assert.equal(result.billingEmail, "billing@sharkclub.example");
  assert.equal(result.tipitFeePercent, 5);
  assert.equal(result.payrollFrequency, "WEEKLY");
});

test("update status only changes the customer status and returns mapped response", async () => {
  let updatedStatus: unknown;

  const service = new CustomersService({
    customer: {
      findMany: async () => [],
      findUnique: async () => baseCustomerRecord,
      create: async () => ({ id: "customer-1" }),
      update: async ({ data }: { data: { status: string } }) => {
        updatedStatus = data.status;
        return baseCustomerRecord;
      },
    },
    payrollConfig: {
      create: async () => ({}),
    },
    $transaction: async () => "customer-1",
  } as never);

  const result = await service.updateStatus("customer-1", { status: "SUSPENDED" });

  assert.equal(updatedStatus, "SUSPENDED");
  assert.equal(result.status, "ACTIVE");
  assert.equal(result.settlementFrequency, "WEEKLY");
});
