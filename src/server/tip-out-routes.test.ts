import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { prisma } from "../lib/prisma";
import { backendRoutes } from "./routes";
import { createApiRouter } from "./shared/http/router";

const router = createApiRouter(backendRoutes);

async function requestJson<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  options?: {
    token?: string;
    body?: unknown;
  },
): Promise<{ status: number; body: T }> {
  const headers = new Headers();
  if (options?.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }
  if (options?.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  const request = new NextRequest(`http://localhost/api/v1${path}`, {
    method,
    headers,
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const response = await router(request, request.nextUrl.pathname.replace("/api/v1", ""));
  const body = (await response.json()) as T;

  return {
    status: response.status,
    body,
  };
}

async function login(email: string, password: string) {
  const response = await requestJson<{
    data: {
      token: string;
    };
  }>("POST", "/auth/login", {
    body: { email, password },
  });

  assert.equal(response.status, 200);
  return response.body.data.token;
}

test("tip-out posting is deducted from available tip balance and posted into the target pool", async () => {
  const token = await login("manager@sandman.example", "Password123!");
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const [customer, venue, department, payrollPeriod] = await Promise.all([
    prisma.customer.findFirstOrThrow({
      where: { slug: "sandman-hospitality-group" },
      select: { id: true },
    }),
    prisma.venue.findFirstOrThrow({
      where: { slug: "sandman-signature-newcastle" },
      select: { id: true },
    }),
    prisma.department.findFirstOrThrow({
      where: { slug: "breakfast", venue: { slug: "sandman-signature-newcastle" } },
      select: { id: true, venueId: true },
    }),
    prisma.payrollPeriod.findFirstOrThrow({
      where: { customer: { slug: "sandman-hospitality-group" } },
      orderBy: { startDate: "desc" },
      select: { id: true, startDate: true },
    }),
  ]);

  const staffMembers = await Promise.all(
    ["Ava", "Noah"].map((firstName, index) =>
      prisma.staffMember.create({
        data: {
          customerId: customer.id,
          venueId: venue.id,
          firstName,
          lastName: `TipOut${suffix}${index}`,
          displayName: firstName,
          email: `tipout-${suffix}-${index}@sandman.example`,
          departmentAssignments: {
            create: {
              customerId: customer.id,
              venueId: venue.id,
              departmentId: department.id,
              isPrimary: index === 0,
            },
          },
        },
        select: { id: true, displayName: true, firstName: true, lastName: true },
      }),
    ),
  );

  assert.equal(staffMembers.length, 2);

  const pool = await prisma.pool.create({
    data: {
      customerId: customer.id,
      venueId: venue.id,
      name: `Tip-Out Pool ${suffix}`,
      slug: `tip-out-pool-${suffix}`,
      poolType: "FOH",
      members: {
        create: staffMembers.map((staffMember) => ({
          staffMemberId: staffMember.id,
        })),
      },
    },
    select: { id: true, name: true },
  });

  const createRule = await requestJson<{
    data: {
      id: string;
      scope: string;
      ratePercentage: number;
      targetPoolId: string;
    };
  }>("POST", "/customer-admin/tip-out-rules", {
    token,
    body: {
      scope: "DEPARTMENT",
      venueId: venue.id,
      departmentId: department.id,
      targetPoolId: pool.id,
      name: `Breakfast tip-out ${suffix}`,
      rateDecimal: 0.015,
      capAtAvailableTipBalance: true,
    },
  });

  assert.equal(createRule.status, 201);
  assert.equal(createRule.body.data.scope, "DEPARTMENT");
  assert.equal(createRule.body.data.ratePercentage, 1.5);
  assert.equal(createRule.body.data.targetPoolId, pool.id);

  const preview = await requestJson<{
    data: {
      requestedTipOutAmount: number;
      tipOutAmount: number;
      netSales: number;
      targetPool: { id: string };
    };
  }>("POST", "/customer-admin/tip-out-rules/preview", {
    token,
    body: {
      venueId: venue.id,
      departmentId: department.id,
      staffMemberId: staffMembers[0].id,
      totalSales: 2000,
      discounts: 50,
      availableTipBalance: 100,
    },
  });

  assert.equal(preview.status, 200);
  assert.equal(preview.body.data.netSales, 1950);
  assert.equal(preview.body.data.requestedTipOutAmount, 29.25);
  assert.equal(preview.body.data.tipOutAmount, 29.25);
  assert.equal(preview.body.data.targetPool.id, pool.id);

  const posting = await requestJson<{
    data: {
      id: string;
      targetPool: { id: string };
      tipOutAmount: number;
      remainingTipBalanceAmount: number;
      payrollPeriodId: string | null;
    };
  }>("POST", "/customer-admin/tip-out-rules/postings", {
    token,
    body: {
      venueId: venue.id,
      departmentId: department.id,
      staffMemberId: staffMembers[0].id,
      businessDate: payrollPeriod.startDate.toISOString(),
      totalSales: 2000,
      discounts: 50,
      availableTipBalance: 100,
    },
  });

  assert.equal(posting.status, 201);
  assert.equal(posting.body.data.targetPool.id, pool.id);
  assert.equal(posting.body.data.tipOutAmount, 29.25);
  assert.equal(posting.body.data.remainingTipBalanceAmount, 70.75);
  assert.ok(posting.body.data.payrollPeriodId);

  await prisma.importedHoursWorked.createMany({
    data: [
      {
        customerId: customer.id,
        venueId: venue.id,
        departmentId: department.id,
        staffMemberId: staffMembers[0].id,
        integrationProvider: "OTHER",
        externalRecordRef: `tipout-hours-a-${suffix}`,
        sourceSystemName: "Manual",
        status: "SUCCEEDED",
        workDate: payrollPeriod.startDate,
        hoursWorked: 2,
      },
      {
        customerId: customer.id,
        venueId: venue.id,
        departmentId: department.id,
        staffMemberId: staffMembers[1].id,
        integrationProvider: "OTHER",
        externalRecordRef: `tipout-hours-b-${suffix}`,
        sourceSystemName: "Manual",
        status: "SUCCEEDED",
        workDate: payrollPeriod.startDate,
        hoursWorked: 3,
      },
    ],
  });

  const payrollPreview = await requestJson<{
    data: {
      poolTotal: number;
      totalHoursWorked: number;
      perHourRate: number;
      allocations: Array<{
        staffMemberId: string;
        allocationAmount: number;
      }>;
    };
  }>("POST", "/customer-admin/tip-out-rules/payroll-distribution-preview", {
    token,
    body: {
      poolId: pool.id,
      payrollPeriodId: posting.body.data.payrollPeriodId,
    },
  });

  assert.equal(payrollPreview.status, 200);
  assert.equal(payrollPreview.body.data.poolTotal, 29.25);
  assert.equal(payrollPreview.body.data.totalHoursWorked, 5);
  assert.equal(payrollPreview.body.data.perHourRate, 5.85);

  const allocationsByStaffId = new Map(
    payrollPreview.body.data.allocations.map((allocation) => [
      allocation.staffMemberId,
      allocation.allocationAmount,
    ]),
  );

  assert.equal(allocationsByStaffId.get(staffMembers[0].id), 11.7);
  assert.equal(allocationsByStaffId.get(staffMembers[1].id), 17.55);

  const manualHoursSave = await requestJson<{
    data: {
      totalHoursWorked: number;
      perHourRate: number;
      allocations: Array<{
        staffMemberId: string;
        allocationAmount: number;
      }>;
    };
  }>("POST", "/customer-admin/tip-out-rules/manual-hours", {
    token,
    body: {
      poolId: pool.id,
      payrollPeriodId: posting.body.data.payrollPeriodId,
      entries: [
        { staffMemberId: staffMembers[0].id, hoursWorked: 4 },
        { staffMemberId: staffMembers[1].id, hoursWorked: 1 },
      ],
    },
  });

  assert.equal(manualHoursSave.status, 200);
  assert.equal(manualHoursSave.body.data.totalHoursWorked, 5);
  assert.equal(manualHoursSave.body.data.perHourRate, 5.85);
  const manualAllocationsByStaffId = new Map(
    manualHoursSave.body.data.allocations.map((allocation) => [
      allocation.staffMemberId,
      allocation.allocationAmount,
    ]),
  );
  assert.equal(manualAllocationsByStaffId.get(staffMembers[0].id), 23.4);
  assert.equal(manualAllocationsByStaffId.get(staffMembers[1].id), 5.85);

  const auditRows = await prisma.auditLog.findMany({
    where: {
      action: {
        in: ["tip-out-rule.created", "tip-out.posted", "tip-out.manual-hours.saved"],
      },
    },
    orderBy: { createdAt: "asc" },
    select: { action: true },
  });

  assert.deepEqual(
    auditRows.slice(-3).map((row) => row.action),
    ["tip-out-rule.created", "tip-out.posted", "tip-out.manual-hours.saved"],
  );
});

test("customer and venue scope fallbacks resolve in the correct hierarchy", async () => {
  const token = await login("manager@sandman.example", "Password123!");
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const [customer, venue, payrollPeriod, outletBrand] = await Promise.all([
    prisma.customer.findFirstOrThrow({
      where: { slug: "sandman-hospitality-group" },
      select: { id: true },
    }),
    prisma.venue.findFirstOrThrow({
      where: { slug: "sandman-signature-newcastle" },
      select: { id: true },
    }),
    prisma.payrollPeriod.findFirstOrThrow({
      where: { customer: { slug: "sandman-hospitality-group" } },
      orderBy: { startDate: "desc" },
      select: { startDate: true },
    }),
    prisma.outletBrand.findFirstOrThrow({
      where: { customer: { slug: "sandman-hospitality-group" }, venue: { slug: "sandman-signature-newcastle" } },
      select: { id: true },
    }),
  ]);

  const department = await prisma.department.create({
    data: {
      customerId: customer.id,
      venueId: venue.id,
      outletBrandId: outletBrand.id,
      name: `Scope Fallback ${suffix}`,
      slug: `scope-fallback-${suffix}`,
      revenueCentreType: "BAR",
      description: "Department used to test customer and venue fallback logic.",
      isActive: true,
    },
    select: { id: true },
  });

  const staffMember = await prisma.staffMember.create({
    data: {
      customerId: customer.id,
      venueId: venue.id,
      firstName: "Scope",
      lastName: `Tester${suffix}`,
      displayName: "Scope Tester",
      email: `scope-${suffix}@sandman.example`,
      departmentAssignments: {
        create: {
          customerId: customer.id,
          venueId: venue.id,
          departmentId: department.id,
          isPrimary: true,
        },
      },
    },
    select: { id: true },
  });

  const customerPool = await prisma.pool.create({
    data: {
      customerId: customer.id,
      venueId: venue.id,
      name: `Customer Scope Pool ${suffix}`,
      slug: `customer-scope-pool-${suffix}`,
      poolType: "BOH",
    },
    select: { id: true },
  });

  const venuePool = await prisma.pool.create({
    data: {
      customerId: customer.id,
      venueId: venue.id,
      name: `Venue Scope Pool ${suffix}`,
      slug: `venue-scope-pool-${suffix}`,
      poolType: "FOH",
    },
    select: { id: true },
  });

  await requestJson("POST", "/customer-admin/tip-out-rules", {
    token,
    body: {
      scope: "CUSTOMER",
      targetPoolId: customerPool.id,
      name: `Customer fallback ${suffix}`,
      rateDecimal: 0.01,
      capAtAvailableTipBalance: true,
    },
  });

  const venueRule = await requestJson<{
    data: { id: string; scope: string; targetPoolId: string };
  }>("POST", "/customer-admin/tip-out-rules", {
    token,
    body: {
      scope: "VENUE",
      venueId: venue.id,
      targetPoolId: venuePool.id,
      name: `Venue fallback ${suffix}`,
      rateDecimal: 0.02,
      capAtAvailableTipBalance: true,
    },
  });

  assert.equal(venueRule.status, 201);
  assert.equal(venueRule.body.data.scope, "VENUE");

  const preview = await requestJson<{
    data: {
      rule: { id: string; scope: string; targetPoolId: string };
      tipOutAmount: number;
    };
  }>("POST", "/customer-admin/tip-out-rules/preview", {
    token,
    body: {
      venueId: venue.id,
      departmentId: department.id,
      staffMemberId: staffMember.id,
      businessDate: payrollPeriod.startDate.toISOString(),
      totalSales: 1000,
      discounts: 0,
      availableTipBalance: 100,
    },
  });

  assert.equal(preview.status, 200);
  assert.equal(preview.body.data.rule.scope, "VENUE");
  assert.equal(preview.body.data.rule.targetPoolId, venuePool.id);
  assert.equal(preview.body.data.tipOutAmount, 20);
});
