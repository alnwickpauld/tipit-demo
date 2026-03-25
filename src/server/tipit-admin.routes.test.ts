import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { backendRoutes } from "./routes";
import { createApiRouter } from "./shared/http/router";

const router = createApiRouter(backendRoutes);

async function requestJson<T>(
  method: "GET" | "POST" | "PATCH",
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

  const response = await router(request, path);
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
    body: {
      email,
      password,
    },
  });

  assert.equal(response.status, 200);
  return response.body.data.token;
}

test("tipit admin customer routes reject unauthenticated requests", async () => {
  const response = await requestJson<{
    error: string;
    message: string;
  }>("GET", "/tipit-admin/customers");

  assert.equal(response.status, 401);
  assert.equal(response.body.error, "AUTHENTICATION_REQUIRED");
});

test("customer viewer cannot access tipit admin customer routes", async () => {
  const token = await login("viewer@ember.example", "Password123!");
  const response = await requestJson<{
    error: string;
  }>("GET", "/tipit-admin/customers", { token });

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "FORBIDDEN");
});

test("tipit admin can manage customers and customer users through the router", async () => {
  const token = await login("platform-admin@tipit.example", "Password123!");
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const createCustomer = await requestJson<{
    data: {
      id: string;
      billingEmail: string;
      tipitFeePercent: number;
      payrollFrequency: string | null;
      settlementFrequency: string;
      status: string;
    };
  }>("POST", "/tipit-admin/customers", {
    token,
    body: {
      name: `North Star Hospitality ${suffix}`,
      slug: `north-star-${suffix}`,
      legalName: `North Star Hospitality Group ${suffix}`,
      billingEmail: `billing-${suffix}@northstar.example`,
      status: "ACTIVE",
      tipitFeePercent: 4.5,
      payrollFrequency: "MONTHLY",
      payrollAnchorDate: "2026-02-01T00:00:00.000Z",
      settlementFrequency: "WEEKLY",
      contactPhone: "+44 161 555 0199",
      currency: "GBP",
      timezone: "Europe/London",
    },
  });

  assert.equal(createCustomer.status, 201);
  assert.equal(createCustomer.body.data.billingEmail, `billing-${suffix}@northstar.example`);
  assert.equal(createCustomer.body.data.tipitFeePercent, 4.5);
  assert.equal(createCustomer.body.data.payrollFrequency, "MONTHLY");
  assert.equal(createCustomer.body.data.settlementFrequency, "WEEKLY");

  const customerId = createCustomer.body.data.id;

  const getCustomer = await requestJson<{
    data: {
      id: string;
      billingEmail: string;
      status: string;
    };
  }>("GET", `/tipit-admin/customers/${customerId}`, { token });

  assert.equal(getCustomer.status, 200);
  assert.equal(getCustomer.body.data.id, customerId);

  const updateCustomer = await requestJson<{
    data: {
      tipitFeePercent: number;
      payrollFrequency: string | null;
      settlementFrequency: string;
      status: string;
    };
  }>("PATCH", `/tipit-admin/customers/${customerId}`, {
    token,
    body: {
      tipitFeePercent: 5.25,
      payrollFrequency: "FORTNIGHTLY",
      payrollAnchorDate: "2026-02-15T00:00:00.000Z",
      settlementFrequency: "MONTHLY",
      status: "ACTIVE",
    },
  });

  assert.equal(updateCustomer.status, 200);
  assert.equal(updateCustomer.body.data.tipitFeePercent, 5.25);
  assert.equal(updateCustomer.body.data.payrollFrequency, "FORTNIGHTLY");
  assert.equal(updateCustomer.body.data.settlementFrequency, "MONTHLY");

  const suspendCustomer = await requestJson<{
    data: {
      status: string;
    };
  }>("PATCH", `/tipit-admin/customers/${customerId}/status`, {
    token,
    body: {
      status: "SUSPENDED",
    },
  });

  assert.equal(suspendCustomer.status, 200);
  assert.equal(suspendCustomer.body.data.status, "SUSPENDED");

  const createCustomerUser = await requestJson<{
    data: {
      id: string;
      isActive: boolean;
      user: {
        email: string;
        isActive: boolean;
      };
      role: {
        code: string;
      };
    };
  }>("POST", `/tipit-admin/customers/${customerId}/users`, {
    token,
    body: {
      email: `admin-${suffix}@northstar.example`,
      firstName: "Morgan",
      lastName: "Lane",
      password: "Password123!",
      role: "CUSTOMER_ADMIN",
    },
  });

  assert.equal(createCustomerUser.status, 201);
  assert.equal(createCustomerUser.body.data.user.email, `admin-${suffix}@northstar.example`);
  assert.equal(createCustomerUser.body.data.role.code, "CUSTOMER_ADMIN");

  const customerUserId = createCustomerUser.body.data.id;

  const listCustomerUsers = await requestJson<{
    data: Array<{
      id: string;
    }>;
  }>("GET", `/tipit-admin/customers/${customerId}/users`, { token });

  assert.equal(listCustomerUsers.status, 200);
  assert.ok(listCustomerUsers.body.data.some((user) => user.id === customerUserId));

  const deactivateCustomerUser = await requestJson<{
    data: {
      isActive: boolean;
      user: {
        isActive: boolean;
      };
    };
  }>("PATCH", `/tipit-admin/customers/${customerId}/users/${customerUserId}/status`, {
    token,
    body: {
      isActive: false,
    },
  });

  assert.equal(deactivateCustomerUser.status, 200);
  assert.equal(deactivateCustomerUser.body.data.isActive, false);
  assert.equal(deactivateCustomerUser.body.data.user.isActive, false);
});
