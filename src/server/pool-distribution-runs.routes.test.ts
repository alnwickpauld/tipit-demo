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

async function clearPoolDistributionState(poolId: string, payrollPeriodId: string) {
  await prisma.poolDistributionAllocation.deleteMany({
    where: {
      poolId,
      payrollPeriodId,
    },
  });
  await prisma.poolDistributionRun.deleteMany({
    where: {
      poolId,
      payrollPeriodId,
    },
  });
  await prisma.poolHoursEntry.deleteMany({
    where: {
      poolId,
      payrollPeriodId,
    },
  });
}

test("pool distribution flow saves hours, previews allocations, locks, exports, and blocks editing while locked", async () => {
  const adminToken = await login("admin@sandman.example", "Password123!");
  const managerToken = await login("manager@sandman.example", "Password123!");

  const pool = await prisma.pool.findFirstOrThrow({
    where: { slug: "breakfast-team-pool" },
    select: { id: true, venueId: true },
  });
  const payrollPeriod = await prisma.payrollPeriod.findFirstOrThrow({
    where: { customer: { slug: "sandman-hospitality-group" } },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });

  await clearPoolDistributionState(pool.id, payrollPeriod.id);

  const members = await prisma.poolMember.findMany({
    where: {
      poolId: pool.id,
      isActive: true,
      staffMember: { status: "ACTIVE" },
    },
    include: {
      staffMember: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          payrollReference: true,
        },
      },
    },
    orderBy: [{ staffMember: { lastName: "asc" } }, { staffMember: { firstName: "asc" } }],
    take: 3,
  });

  assert.equal(members.length, 3);

  const saveHours = await requestJson<{
    data: {
      employees: Array<{ employeeId: string; hoursWorked: number }>;
    };
  }>("POST", "/customer-admin/pool-distributions/hours", {
    token: managerToken,
    body: {
      poolId: pool.id,
      payrollPeriodId: payrollPeriod.id,
      poolTotal: 500,
      entries: [
        { employeeId: members[0]!.staffMember.id, hoursWorked: 90, source: "MANUAL" },
        { employeeId: members[1]!.staffMember.id, hoursWorked: 10, source: "MANUAL" },
        { employeeId: members[2]!.staffMember.id, hoursWorked: 200, source: "MANUAL" },
      ],
    },
  });

  assert.equal(saveHours.status, 200);
  assert.deepEqual(
    saveHours.body.data.employees
      .filter((employee) => employee.hoursWorked > 0)
      .map((employee) => employee.hoursWorked)
      .sort((left, right) => left - right),
    [10, 90, 200],
  );

  const preview = await requestJson<{
    data: {
      runId: string;
      status: string;
      totalHours: number;
      perHourRate: number;
      allocations: Array<{ employeeId: string; allocationAmount: number }>;
    };
  }>("POST", "/customer-admin/pool-distributions/preview", {
    token: managerToken,
    body: {
      poolId: pool.id,
      payrollPeriodId: payrollPeriod.id,
      poolTotal: 500,
    },
  });

  assert.equal(preview.status, 200);
  assert.equal(preview.body.data.status, "READY_FOR_REVIEW");
  assert.equal(preview.body.data.totalHours, 300);
  assert.equal(preview.body.data.perHourRate, 1.66666667);
  assert.equal(
    Number(preview.body.data.allocations.reduce((sum, allocation) => sum + allocation.allocationAmount, 0).toFixed(2)),
    500,
  );

  const locked = await requestJson<{
    data: {
      runId: string;
      status: string;
    };
  }>("POST", "/customer-admin/pool-distributions/lock", {
    token: managerToken,
    body: {
      poolId: pool.id,
      payrollPeriodId: payrollPeriod.id,
      poolTotal: 500,
    },
  });

  assert.equal(locked.status, 200);
  assert.equal(locked.body.data.status, "LOCKED");

  const saveWhileLocked = await requestJson<{ error: string; message: string }>(
    "POST",
    "/customer-admin/pool-distributions/hours",
    {
      token: managerToken,
      body: {
        poolId: pool.id,
        payrollPeriodId: payrollPeriod.id,
        poolTotal: 500,
        entries: [{ employeeId: members[0]!.staffMember.id, hoursWorked: 100, source: "MANUAL" }],
      },
    },
  );

  assert.equal(saveWhileLocked.status, 400);
  assert.equal(saveWhileLocked.body.error, "VALIDATION_ERROR");

  const exportRows = await requestJson<{
    data: Array<{
      employeeId: string;
      payrollReference: string | null;
      poolAllocation: number;
      hoursWorked: number;
      hoursSource: string;
    }>;
  }>(
    "GET",
    `/customer-admin/pool-distributions/export-rows?payrollPeriodId=${encodeURIComponent(payrollPeriod.id)}&venueId=${encodeURIComponent(pool.venueId)}`,
    {
      token: managerToken,
    },
  );

  assert.equal(exportRows.status, 200);
  assert.deepEqual(
    exportRows.body.data
      .filter((row) => row.hoursWorked > 0)
      .map((row) => row.hoursWorked)
      .sort((left, right) => left - right),
    [10, 90, 200],
  );
  assert.equal(
    Number(exportRows.body.data.reduce((sum, row) => sum + row.poolAllocation, 0).toFixed(2)),
    500,
  );
  assert.ok(exportRows.body.data.some((row) => row.hoursSource === "MANUAL"));

  const unlockAsManager = await requestJson<{ error: string }>(
    "POST",
    `/customer-admin/pool-distributions/${locked.body.data.runId}/unlock`,
    { token: managerToken },
  );

  assert.equal(unlockAsManager.status, 403);

  const unlockAsAdmin = await requestJson<{ data: { unlocked: true } }>(
    "POST",
    `/customer-admin/pool-distributions/${locked.body.data.runId}/unlock`,
    { token: adminToken },
  );

  assert.equal(unlockAsAdmin.status, 200);
  assert.equal(unlockAsAdmin.body.data.unlocked, true);
});

test("pool distribution preview rejects zero total hours with a clear validation error", async () => {
  const token = await login("manager@sandman.example", "Password123!");
  const pool = await prisma.pool.findFirstOrThrow({
    where: { slug: "breakfast-team-pool" },
    select: { id: true },
  });
  const payrollPeriod = await prisma.payrollPeriod.findFirstOrThrow({
    where: { customer: { slug: "sandman-hospitality-group" } },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });

  await clearPoolDistributionState(pool.id, payrollPeriod.id);

  const members = await prisma.poolMember.findMany({
    where: {
      poolId: pool.id,
      isActive: true,
      staffMember: { status: "ACTIVE" },
    },
    select: { staffMemberId: true },
    take: 2,
  });

  await requestJson("POST", "/customer-admin/pool-distributions/hours", {
    token,
    body: {
      poolId: pool.id,
      payrollPeriodId: payrollPeriod.id,
      poolTotal: 500,
      entries: members.map((member) => ({
        employeeId: member.staffMemberId,
        hoursWorked: 0,
        source: "MANUAL",
      })),
    },
  });

  const preview = await requestJson<{ error: string; message: string }>(
    "POST",
    "/customer-admin/pool-distributions/preview",
    {
      token,
      body: {
        poolId: pool.id,
        payrollPeriodId: payrollPeriod.id,
        poolTotal: 500,
      },
    },
  );

  assert.equal(preview.status, 400);
  assert.equal(preview.body.error, "VALIDATION_ERROR");
  assert.match(preview.body.message, /total eligible hours are zero/i);
});
