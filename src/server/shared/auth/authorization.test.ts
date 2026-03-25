import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { requireAuth } from "./auth-middleware";
import {
  assertTenantAccess,
  hasPermission,
} from "./authorization";
import type { AuthenticatedUser } from "./types";

const tipitAdmin: AuthenticatedUser = {
  userId: "tipit-admin",
  customerUserId: null,
  customerId: null,
  email: "admin@tipit.example",
  firstName: "Tipit",
  lastName: "Admin",
  role: "TIPIT_ADMIN",
  scope: "TIPIT_ADMIN",
};

const customerViewer: AuthenticatedUser = {
  userId: "viewer-1",
  customerUserId: "cu-1",
  customerId: "customer-1",
  email: "viewer@example.com",
  firstName: "Casey",
  lastName: "Viewer",
  role: "CUSTOMER_VIEWER",
  scope: "CUSTOMER_ADMIN",
};

test("requireAuth rejects requests without a session", async () => {
  const request = new NextRequest("http://localhost/api/v1/auth/me");

  await assert.rejects(
    () =>
      requireAuth(
        {
          request,
          params: {},
          user: null,
        },
        async () => new Response("ok"),
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Authentication required",
  );
});

test("customer viewer has read permission but cannot manage operations", () => {
  assert.equal(hasPermission(customerViewer, "customer:read"), true);
  assert.equal(hasPermission(customerViewer, "customer:operations:manage"), false);
});

test("tenant access helper rejects cross-customer access", () => {
  assert.throws(
    () => assertTenantAccess(customerViewer, "customer-2"),
    /another customer/,
  );
});

test("tipit admin bypasses customer tenant checks", () => {
  assert.doesNotThrow(() => assertTenantAccess(tipitAdmin, "customer-2"));
});
