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
    body: { email, password },
  });

  assert.equal(response.status, 200);
  return response.body.data.token;
}

test("customer viewer can read venues and payroll settings but cannot modify data", async () => {
  const token = await login("viewer@ember.example", "Password123!");

  const venues = await requestJson<{
    data: {
      items: Array<{
        name: string;
      }>;
      pagination: {
        total: number;
      };
    };
  }>("GET", "/customer-admin/venues", { token });

  assert.equal(venues.status, 200);
  assert.ok(venues.body.data.items.some((venue) => venue.name === "Ember Leeds"));
  assert.ok(venues.body.data.pagination.total >= 1);

  const payrollSettings = await requestJson<{
    data: {
      id: string;
      payrollConfig: {
        frequency: string;
      } | null;
    };
  }>("GET", "/customer-admin/payroll-settings", { token });

  assert.equal(payrollSettings.status, 200);
  assert.equal(payrollSettings.body.data.payrollConfig?.frequency, "FORTNIGHTLY");

  const createVenue = await requestJson<{
    error: string;
  }>("POST", "/customer-admin/venues", {
    token,
    body: {
      name: "Viewer Should Not Create",
      slug: `viewer-nope-${Date.now()}`,
    },
  });

  assert.equal(createVenue.status, 403);
  assert.equal(createVenue.body.error, "FORBIDDEN");
});

test("customer manager can manage venues, staff, pools, and allocation rules for their own customer", async () => {
  const token = await login("ops@sharkclub.example", "Password123!");
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const createVenue = await requestJson<{
    data: {
      id: string;
      name: string;
    };
  }>("POST", "/customer-admin/venues", {
    token,
    body: {
      name: `Shark Club Test Venue ${suffix}`,
      slug: `shark-test-${suffix}`,
      city: "Newcastle upon Tyne",
      country: "GB",
    },
  });

  assert.equal(createVenue.status, 201);
  const venueId = createVenue.body.data.id;

  const createStaff = await requestJson<{
    data: {
      id: string;
      firstName: string;
      venueId: string;
      status: string;
    };
  }>("POST", "/customer-admin/staff", {
    token,
    body: {
      venueId,
      externalPayrollRef: `SCN-EXT-${suffix}`,
      firstName: "Morgan",
      lastName: "Lane",
      displayName: "Morgan",
      email: `morgan-${suffix}@sharkclub.example`,
      staffCode: `SCN-T-${suffix}`,
    },
  });

  assert.equal(createStaff.status, 201);
  const staffMemberId = createStaff.body.data.id;
  assert.equal(createStaff.body.data.status, "ACTIVE");

  const getStaffMember = await requestJson<{
    data: {
      id: string;
      staffCode: string | null;
      externalPayrollRef: string | null;
    };
  }>("GET", `/customer-admin/staff/${staffMemberId}`, {
    token,
  });

  assert.equal(getStaffMember.status, 200);
  assert.equal(getStaffMember.body.data.staffCode, `SCN-T-${suffix}`);
  assert.equal(getStaffMember.body.data.externalPayrollRef, `SCN-EXT-${suffix}`);

  const deactivateStaffMember = await requestJson<{
    data: {
      status: string;
    };
  }>("PATCH", `/customer-admin/staff/${staffMemberId}/status`, {
    token,
    body: {
      status: "INACTIVE",
    },
  });

  assert.equal(deactivateStaffMember.status, 200);
  assert.equal(deactivateStaffMember.body.data.status, "INACTIVE");

  const createPool = await requestJson<{
    data: {
      id: string;
      name: string;
    };
  }>("POST", "/customer-admin/pools", {
    token,
    body: {
      venueId,
      name: `Service Pool ${suffix}`,
      slug: `service-pool-${suffix}`,
      memberStaffIds: [staffMemberId],
    },
  });

  assert.equal(createPool.status, 201);
  const poolId = createPool.body.data.id;

  const createRule = await requestJson<{
    data: {
      id: string;
      name: string;
    };
  }>("POST", "/customer-admin/allocation-rules", {
    token,
    body: {
      venueId,
      name: `Manager Rule ${suffix}`,
      priority: 100,
      isActive: true,
      lines: [
        {
          recipientType: "STAFF",
          staffMemberId,
          percentageBps: 6000,
          sortOrder: 1,
        },
        {
          recipientType: "POOL",
          poolId,
          percentageBps: 4000,
          sortOrder: 2,
        },
      ],
    },
  });

  assert.equal(createRule.status, 201);

  const updateVenue = await requestJson<{
    data: {
      status: string;
      name: string;
    };
  }>("PATCH", `/customer-admin/venues/${venueId}`, {
    token,
    body: {
      status: "INACTIVE",
    },
  });

  assert.equal(updateVenue.status, 200);
  assert.equal(updateVenue.body.data.status, "INACTIVE");

  const updatePayrollSettings = await requestJson<{
    error: string;
  }>("PATCH", "/customer-admin/payroll-settings", {
    token,
    body: {
      frequency: "MONTHLY",
      settlementDay: 10,
    },
  });

  assert.equal(updatePayrollSettings.status, 403);
  assert.equal(updatePayrollSettings.body.error, "FORBIDDEN");
});

test("customer manager can delete clean staff and venue records for their own customer", async () => {
  const token = await login("ops@sharkclub.example", "Password123!");
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const createVenue = await requestJson<{
    data: {
      id: string;
    };
  }>("POST", "/customer-admin/venues", {
    token,
    body: {
      name: `Disposable Venue ${suffix}`,
      slug: `disposable-venue-${suffix}`,
    },
  });

  assert.equal(createVenue.status, 201);

  const createStaff = await requestJson<{
    data: {
      id: string;
    };
  }>("POST", "/customer-admin/staff", {
    token,
    body: {
      venueId: createVenue.body.data.id,
      firstName: "Delete",
      lastName: "Me",
      displayName: `Disposable ${suffix}`,
    },
  });

  assert.equal(createStaff.status, 201);

  const deleteStaff = await requestJson<{
    data: {
      id: string;
      deleted: boolean;
    };
  }>("DELETE", `/customer-admin/staff/${createStaff.body.data.id}`, {
    token,
  });

  assert.equal(deleteStaff.status, 200);
  assert.equal(deleteStaff.body.data.deleted, true);

  const deleteVenue = await requestJson<{
    data: {
      id: string;
      deleted: boolean;
    };
  }>("DELETE", `/customer-admin/venues/${createVenue.body.data.id}`, {
    token,
  });

  assert.equal(deleteVenue.status, 200);
  assert.equal(deleteVenue.body.data.deleted, true);
});

test("customer manager cannot delete a venue with linked operational history", async () => {
  const token = await login("ops@sharkclub.example", "Password123!");
  const sharkVenue = await prisma.venue.findFirstOrThrow({
    where: {
      customer: {
        slug: "shark-club-uk",
      },
    },
    select: { id: true },
  });

  const response = await requestJson<{
    error: string;
    message: string;
  }>("DELETE", `/customer-admin/venues/${sharkVenue.id}`, {
    token,
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "VALIDATION_ERROR");
});

test("customer admin can update payroll settings for their own customer", async () => {
  const token = await login("manager@sharkclub.example", "Password123!");

  const response = await requestJson<{
    data: {
      payrollConfig: {
        frequency: string;
        settlementDay: number | null;
        settlementFrequency: string;
      } | null;
      currency: string;
    };
  }>("PATCH", "/customer-admin/payroll-settings", {
    token,
    body: {
      frequency: "MONTHLY",
      settlementDay: 12,
      settlementFrequency: "FORTNIGHTLY",
      exportEmail: "payroll-updated@sharkclub.example",
      notes: "Updated via integration test",
      timezone: "Europe/London",
      currency: "GBP",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.payrollConfig?.frequency, "MONTHLY");
  assert.equal(response.body.data.payrollConfig?.settlementDay, 12);
  assert.equal(response.body.data.currency, "GBP");
});

test("customer manager cannot update another customer's venue", async () => {
  const token = await login("ops@sharkclub.example", "Password123!");
  const emberVenue = await prisma.venue.findFirstOrThrow({
    where: {
      customer: {
        slug: "ember-dining-co",
      },
    },
    select: { id: true },
  });

  const response = await requestJson<{
    error: string;
    message: string;
  }>("PATCH", `/customer-admin/venues/${emberVenue.id}`, {
    token,
    body: {
      status: "INACTIVE",
    },
  });

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "NOT_FOUND");
});

test("customer manager cannot create a staff member in another customer's venue", async () => {
  const token = await login("ops@sharkclub.example", "Password123!");
  const emberVenue = await prisma.venue.findFirstOrThrow({
    where: {
      customer: {
        slug: "ember-dining-co",
      },
    },
    select: { id: true },
  });

  const response = await requestJson<{
    error: string;
    message: string;
  }>("POST", "/customer-admin/staff", {
    token,
    body: {
      venueId: emberVenue.id,
      firstName: "Cross",
      lastName: "Tenant",
      displayName: "Cross Tenant",
    },
  });

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "NOT_FOUND");
});

test("customer manager can update pool membership and delete a clean pool", async () => {
  const token = await login("ops@sharkclub.example", "Password123!");
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const createVenue = await requestJson<{
    data: {
      id: string;
    };
  }>("POST", "/customer-admin/venues", {
    token,
    body: {
      name: `Pool Venue ${suffix}`,
      slug: `pool-venue-${suffix}`,
    },
  });

  const venueId = createVenue.body.data.id;

  const firstStaff = await requestJson<{ data: { id: string } }>("POST", "/customer-admin/staff", {
    token,
    body: {
      venueId,
      firstName: "Alex",
      lastName: `One${suffix}`,
    },
  });

  const secondStaff = await requestJson<{ data: { id: string } }>("POST", "/customer-admin/staff", {
    token,
    body: {
      venueId,
      firstName: "Jamie",
      lastName: `Two${suffix}`,
    },
  });

  const createPool = await requestJson<{
    data: {
      id: string;
      members: Array<{ staffMemberId: string }>;
    };
  }>("POST", "/customer-admin/pools", {
    token,
    body: {
      venueId,
      name: `Floor Pool ${suffix}`,
      slug: `floor-pool-${suffix}`,
      memberStaffIds: [firstStaff.body.data.id],
    },
  });

  assert.equal(createPool.status, 201);
  assert.equal(createPool.body.data.members.length, 1);

  const updatePool = await requestJson<{
    data: {
      members: Array<{ staffMemberId: string }>;
    };
  }>("PATCH", `/customer-admin/pools/${createPool.body.data.id}`, {
    token,
    body: {
      memberStaffIds: [firstStaff.body.data.id, secondStaff.body.data.id],
    },
  });

  assert.equal(updatePool.status, 200);
  assert.equal(updatePool.body.data.members.length, 2);

  const clearPool = await requestJson<{
    data: {
      members: Array<{ staffMemberId: string }>;
    };
  }>("PATCH", `/customer-admin/pools/${createPool.body.data.id}`, {
    token,
    body: {
      memberStaffIds: [],
    },
  });

  assert.equal(clearPool.status, 200);
  assert.equal(clearPool.body.data.members.length, 0);

  const deletePool = await requestJson<{
    data: {
      deleted: boolean;
    };
  }>("DELETE", `/customer-admin/pools/${createPool.body.data.id}`, {
    token,
  });

  assert.equal(deletePool.status, 200);
  assert.equal(deletePool.body.data.deleted, true);
});

test("customer manager cannot assign staff from another venue into a pool", async () => {
  const token = await login("ops@sharkclub.example", "Password123!");
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const firstVenue = await requestJson<{ data: { id: string } }>("POST", "/customer-admin/venues", {
    token,
    body: {
      name: `Pool Primary ${suffix}`,
      slug: `pool-primary-${suffix}`,
    },
  });
  const secondVenue = await requestJson<{ data: { id: string } }>("POST", "/customer-admin/venues", {
    token,
    body: {
      name: `Pool Secondary ${suffix}`,
      slug: `pool-secondary-${suffix}`,
    },
  });
  const offVenueStaff = await requestJson<{ data: { id: string } }>("POST", "/customer-admin/staff", {
    token,
    body: {
      venueId: secondVenue.body.data.id,
      firstName: "Off",
      lastName: `Venue${suffix}`,
    },
  });

  const response = await requestJson<{
    error: string;
    message: string;
  }>("POST", "/customer-admin/pools", {
    token,
    body: {
      venueId: firstVenue.body.data.id,
      name: `Cross Venue Pool ${suffix}`,
      slug: `cross-venue-pool-${suffix}`,
      memberStaffIds: [offVenueStaff.body.data.id],
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "VALIDATION_ERROR");
});
