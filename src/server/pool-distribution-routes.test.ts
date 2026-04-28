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

test("pool distribution preview calculates per-hour allocations for active pool members only", async () => {
  const token = await login("manager@sandman.example", "Password123!");
  const pool = await prisma.pool.findFirstOrThrow({
    where: { slug: "breakfast-team-pool" },
    include: {
      members: {
        where: { isActive: true },
        include: {
          staffMember: {
            select: { id: true, displayName: true, status: true },
          },
        },
      },
    },
  });

  const activeMembers = pool.members
    .filter((member) => member.staffMember.status === "ACTIVE")
    .slice(0, 3);

  assert.equal(activeMembers.length, 3);

  const preview = await requestJson<{
    data: {
      poolId: string;
      perHourRate: number;
      totalHoursWorked: number;
      allocations: Array<{
        staffMemberId: string;
        allocationAmount: number;
      }>;
    };
  }>("POST", `/customer-admin/pools/${pool.id}/distribution-preview`, {
    token,
    body: {
      poolTotal: 80,
      staffHours: [
        { staffMemberId: activeMembers[0].staffMember.id, hoursWorked: 2 },
        { staffMemberId: activeMembers[1].staffMember.id, hoursWorked: 3 },
        { staffMemberId: activeMembers[2].staffMember.id, hoursWorked: 5 },
      ],
    },
  });

  assert.equal(preview.status, 200);
  assert.equal(preview.body.data.poolId, pool.id);
  assert.equal(preview.body.data.totalHoursWorked, 10);
  assert.equal(preview.body.data.perHourRate, 8);
  assert.equal(
    Number(preview.body.data.allocations.reduce((sum, item) => sum + item.allocationAmount, 0).toFixed(2)),
    80,
  );
});

test("pool distribution preview rejects staff who are not active members of the pool", async () => {
  const token = await login("manager@sandman.example", "Password123!");
  const pool = await prisma.pool.findFirstOrThrow({
    where: { slug: "breakfast-team-pool" },
    select: { id: true, venueId: true },
  });
  const nonMember = await prisma.staffMember.findFirstOrThrow({
    where: {
      venueId: pool.venueId,
      status: "ACTIVE",
      poolMemberships: {
        none: {
          poolId: pool.id,
          isActive: true,
        },
      },
    },
    select: { id: true },
  });

  const preview = await requestJson<{
    error: string;
  }>("POST", `/customer-admin/pools/${pool.id}/distribution-preview`, {
    token,
    body: {
      poolTotal: 80,
      staffHours: [{ staffMemberId: nonMember.id, hoursWorked: 4 }],
    },
  });

  assert.equal(preview.status, 400);
  assert.equal(preview.body.error, "VALIDATION_ERROR");
});
