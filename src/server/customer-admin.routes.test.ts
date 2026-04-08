import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { GET as getPublicStaffOptions } from "../app/api/tip/[slug]/staff-options/route";
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

test("customer manager can manage departments and service areas for their own customer", async () => {
  const token = await login("ops@sharkclub.example", "Password123!");
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const createVenue = await requestJson<{
    data: {
      id: string;
    };
  }>("POST", "/customer-admin/venues", {
    token,
    body: {
      name: `Department Venue ${suffix}`,
      slug: `department-venue-${suffix}`,
    },
  });

  assert.equal(createVenue.status, 201);
  const venueId = createVenue.body.data.id;

  const createDepartment = await requestJson<{
    data: {
      id: string;
      venueId: string;
      type: string;
    };
  }>("POST", "/customer-admin/departments", {
    token,
    body: {
      venueId,
      name: `Breakfast ${suffix}`,
      slug: `breakfast-${suffix}`,
      type: "BREAKFAST",
    },
  });

  assert.equal(createDepartment.status, 201);
  const departmentId = createDepartment.body.data.id;
  assert.equal(createDepartment.body.data.type, "BREAKFAST");

  const listDepartments = await requestJson<{
    data: {
      items: Array<{
        id: string;
      }>;
      pagination: {
        total: number;
      };
    };
  }>("GET", `/customer-admin/departments?venueId=${venueId}`, {
    token,
  });

  assert.equal(listDepartments.status, 200);
  assert.ok(listDepartments.body.data.items.some((item) => item.id === departmentId));

  const createServiceArea = await requestJson<{
    data: {
      id: string;
      departmentId: string;
      tippingMode: string;
      displayMode: string;
    };
  }>("POST", "/customer-admin/service-areas", {
    token,
    body: {
      venueId,
      departmentId,
      name: `Table Card ${suffix}`,
      slug: `table-card-${suffix}`,
      tippingMode: "TEAM_OR_INDIVIDUAL",
      displayMode: "TABLE_CARD",
    },
  });

  assert.equal(createServiceArea.status, 201);
  const serviceAreaId = createServiceArea.body.data.id;
  assert.equal(createServiceArea.body.data.tippingMode, "TEAM_OR_INDIVIDUAL");

  const updateServiceArea = await requestJson<{
    data: {
      displayMode: string;
      isActive: boolean;
    };
  }>("PATCH", `/customer-admin/service-areas/${serviceAreaId}`, {
    token,
    body: {
      displayMode: "FIXED_SIGN",
      isActive: false,
    },
  });

  assert.equal(updateServiceArea.status, 200);
  assert.equal(updateServiceArea.body.data.displayMode, "FIXED_SIGN");
  assert.equal(updateServiceArea.body.data.isActive, false);

  const deleteDepartmentWhileUsed = await requestJson<{
    error: string;
  }>("DELETE", `/customer-admin/departments/${departmentId}`, {
    token,
  });

  assert.equal(deleteDepartmentWhileUsed.status, 400);
  assert.equal(deleteDepartmentWhileUsed.body.error, "VALIDATION_ERROR");

  const deleteServiceArea = await requestJson<{
    data: {
      deleted: boolean;
    };
  }>("DELETE", `/customer-admin/service-areas/${serviceAreaId}`, {
    token,
  });

  assert.equal(deleteServiceArea.status, 200);
  assert.equal(deleteServiceArea.body.data.deleted, true);

  const deleteDepartment = await requestJson<{
    data: {
      deleted: boolean;
    };
  }>("DELETE", `/customer-admin/departments/${departmentId}`, {
    token,
  });

  assert.equal(deleteDepartment.status, 200);
  assert.equal(deleteDepartment.body.data.deleted, true);
});

test("customer manager can manage shifts and enforce department staffing on assignments", async () => {
  const token = await login("ops@sharkclub.example", "Password123!");
  const venue = await prisma.venue.findFirstOrThrow({
    where: { slug: "shark-club-newcastle" },
    select: { id: true },
  });
  const breakfastDepartment = await prisma.department.findFirstOrThrow({
    where: {
      venueId: venue.id,
      slug: "breakfast",
    },
    select: { id: true },
  });
  const maya = await prisma.staffMember.findFirstOrThrow({
    where: {
      venueId: venue.id,
      displayName: "Maya",
    },
    select: { id: true },
  });
  const aisha = await prisma.staffMember.findFirstOrThrow({
    where: {
      venueId: venue.id,
      displayName: "Aisha",
    },
    select: { id: true },
  });
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const createShift = await requestJson<{
    data: {
      id: string;
      status: string;
    };
  }>("POST", "/customer-admin/shifts", {
    token,
    body: {
      venueId: venue.id,
      departmentId: breakfastDepartment.id,
      name: `Breakfast Cover ${suffix}`,
      timezone: "Europe/London",
      startsAt: "2026-04-02T06:00:00.000Z",
      endsAt: "2026-04-02T12:00:00.000Z",
      status: "SCHEDULED",
    },
  });

  assert.equal(createShift.status, 201);
  const shiftId = createShift.body.data.id;

  const addAssignment = await requestJson<{
    data: {
      staffAssignments: Array<{ staffMemberId: string }>;
    };
  }>("POST", `/customer-admin/shifts/${shiftId}/assignments`, {
    token,
    body: {
      staffMemberId: maya.id,
      role: "Breakfast host",
      eligibleForTips: true,
    },
  });

  assert.equal(addAssignment.status, 200);
  assert.ok(addAssignment.body.data.staffAssignments.some((assignment) => assignment.staffMemberId === maya.id));

  const invalidAssignment = await requestJson<{
    error: string;
  }>("POST", `/customer-admin/shifts/${shiftId}/assignments`, {
    token,
    body: {
      staffMemberId: aisha.id,
      role: "Wrong department",
      eligibleForTips: true,
    },
  });

  assert.equal(invalidAssignment.status, 400);
  assert.equal(invalidAssignment.body.error, "VALIDATION_ERROR");

  const shiftDetails = await requestJson<{
    data: {
      staffAssignments: Array<{ id: string; eligibleForTips: boolean }>;
    };
  }>("GET", `/customer-admin/shifts/${shiftId}`, { token });

  assert.equal(shiftDetails.status, 200);
  assert.equal(shiftDetails.body.data.staffAssignments.length, 1);
  const assignmentId = shiftDetails.body.data.staffAssignments[0].id;

  const updateAssignment = await requestJson<{
    data: {
      staffAssignments: Array<{ id: string; eligibleForTips: boolean }>;
    };
  }>("PATCH", `/customer-admin/shifts/${shiftId}/assignments/${assignmentId}`, {
    token,
    body: {
      eligibleForTips: false,
    },
  });

  assert.equal(updateAssignment.status, 200);
  assert.equal(
    updateAssignment.body.data.staffAssignments.find((assignment) => assignment.id === assignmentId)?.eligibleForTips,
    false,
  );

  const removeAssignment = await requestJson<{
    data: {
      deleted: boolean;
    };
  }>("DELETE", `/customer-admin/shifts/${shiftId}/assignments/${assignmentId}`, {
    token,
  });

  assert.equal(removeAssignment.status, 200);
  assert.equal(removeAssignment.body.data.deleted, true);

  const deleteShift = await requestJson<{
    data: {
      deleted: boolean;
    };
  }>("DELETE", `/customer-admin/shifts/${shiftId}`, {
    token,
  });

  assert.equal(deleteShift.status, 200);
  assert.equal(deleteShift.body.data.deleted, true);
});

test("customer manager can manually start and end a shift, and public staff selection follows the active shift", async () => {
  const token = await login("ops@sharkclub.example", "Password123!");
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const createVenue = await requestJson<{
    data: {
      id: string;
    };
  }>("POST", "/customer-admin/venues", {
    token,
    body: {
      name: `Manual Shift Venue ${suffix}`,
      slug: `manual-shift-venue-${suffix}`,
      timezone: "Europe/London",
    },
  });

  assert.equal(createVenue.status, 201);
  const venueId = createVenue.body.data.id;

  const createDepartment = await requestJson<{
    data: {
      id: string;
    };
  }>("POST", "/customer-admin/departments", {
    token,
    body: {
      venueId,
      name: `Breakfast Pilot ${suffix}`,
      slug: `breakfast-pilot-${suffix}`,
      type: "BREAKFAST",
    },
  });

  assert.equal(createDepartment.status, 201);
  const departmentId = createDepartment.body.data.id;
  const venueRecord = await prisma.venue.findUniqueOrThrow({
    where: { id: venueId },
    select: { customerId: true },
  });
  const originalDepartmentSetting = await prisma.customerDepartmentTippingSetting.findUnique({
    where: {
      customerId_departmentType: {
        customerId: venueRecord.customerId,
        departmentType: "BREAKFAST",
      },
    },
  });

  await prisma.customerDepartmentTippingSetting.upsert({
    where: {
      customerId_departmentType: {
        customerId: venueRecord.customerId,
        departmentType: "BREAKFAST",
      },
    },
    create: {
      customerId: venueRecord.customerId,
      departmentType: "BREAKFAST",
      qrTippingEnabled: true,
      teamTippingEnabled: true,
      individualTippingEnabled: true,
      shiftSelectorEnabled: true,
    },
    update: {
      qrTippingEnabled: true,
      teamTippingEnabled: true,
      individualTippingEnabled: true,
      shiftSelectorEnabled: true,
    },
  });

  const [firstStaff] = await Promise.all([
    requestJson<{ data: { id: string } }>("POST", "/customer-admin/staff", {
      token,
      body: {
        venueId,
        departmentIds: [departmentId],
        firstName: "Holly",
        lastName: "Stone",
        displayName: "Holly",
      },
    }),
  ]);

  assert.equal(firstStaff.status, 201);

  const serviceArea = await prisma.serviceArea.create({
    data: {
      customerId: venueRecord.customerId,
      venueId,
      departmentId,
      name: `Breakfast Card ${suffix}`,
      slug: `breakfast-card-${suffix}`,
      tippingMode: "SHIFT_SELECTOR",
      displayMode: "TABLE_CARD",
      noActiveShiftBehavior: "DISABLE_INDIVIDUAL",
      teamTippingEnabled: true,
      individualTippingEnabled: true,
    },
  });

  const createShift = await requestJson<{
    data: {
      id: string;
      status: string;
    };
  }>("POST", "/customer-admin/shifts", {
    token,
    body: {
      venueId,
      departmentId,
      name: `Breakfast Pilot Shift ${suffix}`,
      timezone: "Europe/London",
      startsAt: "2026-04-03T09:00:00.000Z",
      endsAt: "2026-04-03T13:00:00.000Z",
      status: "SCHEDULED",
    },
  });

  assert.equal(createShift.status, 201);
  const shiftId = createShift.body.data.id;

  const assignment = await requestJson<{
    data: {
      staffAssignments: Array<{ staffMemberId: string }>;
    };
  }>("POST", `/customer-admin/shifts/${shiftId}/assignments`, {
    token,
    body: {
      staffMemberId: firstStaff.body.data.id,
      role: "Breakfast lead",
      eligibleForTips: true,
    },
  });

  assert.equal(assignment.status, 200);

  const beforeStart = await getPublicStaffOptions(
    new Request(`http://localhost/api/tip/service-area-${serviceArea.id}/staff-options`),
    {
      params: Promise.resolve({ slug: `service-area-${serviceArea.id}` }),
    },
  );

  assert.equal(beforeStart.status, 200);
  const beforeStartPayload = (await beforeStart.json()) as {
    data: {
      items: Array<unknown>;
      individualSelectionEnabled: boolean;
    };
  };
  assert.deepEqual(beforeStartPayload.data.items, []);

  const startShift = await requestJson<{
    data: {
      id: string;
      status: string;
    };
  }>("POST", `/customer-admin/shifts/${shiftId}/start`, {
    token,
    body: {
      startedAt: "2026-04-02T10:15:00.000Z",
    },
  });

  assert.equal(startShift.status, 200);
  assert.equal(startShift.body.data.status, "ACTIVE");

  const secondShift = await requestJson<{
    data: {
      id: string;
    };
  }>("POST", "/customer-admin/shifts", {
    token,
    body: {
      venueId,
      departmentId,
      name: `Breakfast Pilot Shift B ${suffix}`,
      timezone: "Europe/London",
      startsAt: "2026-04-02T11:00:00.000Z",
      endsAt: "2026-04-02T15:00:00.000Z",
      status: "SCHEDULED",
    },
  });

  assert.equal(secondShift.status, 201);

  const conflictingStart = await requestJson<{
    error: string;
  }>("POST", `/customer-admin/shifts/${secondShift.body.data.id}/start`, {
    token,
    body: {
      startedAt: "2026-04-02T10:20:00.000Z",
    },
  });

  assert.equal(conflictingStart.status, 400);
  assert.equal(conflictingStart.body.error, "VALIDATION_ERROR");

  const afterStart = await getPublicStaffOptions(
    new Request(`http://localhost/api/tip/service-area-${serviceArea.id}/staff-options`),
    {
      params: Promise.resolve({ slug: `service-area-${serviceArea.id}` }),
    },
  );

  assert.equal(afterStart.status, 200);
  const afterStartPayload = (await afterStart.json()) as {
    data: {
      tippingMode: string | null;
      items: Array<{ id: string; displayName: string; roleLabel?: string; sortOrder: number }>;
    };
  };

  assert.equal(afterStartPayload.data.tippingMode, "SHIFT_SELECTOR");
  assert.deepEqual(afterStartPayload.data.items, [
    {
      id: firstStaff.body.data.id,
      displayName: "Holly",
      roleLabel: "Breakfast lead",
      sortOrder: 0,
    },
  ]);

  const endShift = await requestJson<{
    data: {
      id: string;
      status: string;
    };
  }>("POST", `/customer-admin/shifts/${shiftId}/end`, {
    token,
    body: {
      endedAt: "2026-04-02T11:00:00.000Z",
    },
  });

  assert.equal(endShift.status, 200);
  assert.equal(endShift.body.data.status, "COMPLETED");

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "Shift",
      entityId: shiftId,
      action: { in: ["ACTIVATE", "DEACTIVATE"] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      action: true,
      summary: true,
    },
  });

  assert.deepEqual(
    auditLogs.map((log) => log.action),
    ["ACTIVATE", "DEACTIVATE"],
  );

  if (originalDepartmentSetting) {
    await prisma.customerDepartmentTippingSetting.update({
      where: {
        customerId_departmentType: {
          customerId: venueRecord.customerId,
          departmentType: "BREAKFAST",
        },
      },
      data: {
        qrTippingEnabled: originalDepartmentSetting.qrTippingEnabled,
        teamTippingEnabled: originalDepartmentSetting.teamTippingEnabled,
        individualTippingEnabled: originalDepartmentSetting.individualTippingEnabled,
        shiftSelectorEnabled: originalDepartmentSetting.shiftSelectorEnabled,
      },
    });
  }
});

test("customer admin can manage staged tipping rollout settings and customer manager cannot", async () => {
  const adminToken = await login("manager@sharkclub.example", "Password123!");
  const managerToken = await login("ops@sharkclub.example", "Password123!");
  const breakfastServiceArea = await prisma.serviceArea.findFirstOrThrow({
    where: { slug: "breakfast-table-card" },
    select: { id: true },
  });

  const getSettings = await requestJson<{
    data: {
      departmentTippingSettings: Array<{ departmentType: string }>;
      serviceAreas: Array<{ id: string }>;
    };
  }>("GET", "/customer-admin/tipping-settings", {
    token: adminToken,
  });

  assert.equal(getSettings.status, 200);
  assert.ok(getSettings.body.data.departmentTippingSettings.some((setting) => setting.departmentType === "BREAKFAST"));
  assert.ok(getSettings.body.data.serviceAreas.some((serviceArea) => serviceArea.id === breakfastServiceArea.id));

  const updateDepartmentSetting = await requestJson<{
    data: {
      qrTippingEnabled: boolean;
      individualTippingEnabled: boolean;
    };
  }>("PATCH", "/customer-admin/tipping-settings/departments/BREAKFAST", {
    token: adminToken,
    body: {
      qrTippingEnabled: true,
      individualTippingEnabled: false,
      shiftSelectorEnabled: false,
    },
  });

  assert.equal(updateDepartmentSetting.status, 200);
  assert.equal(updateDepartmentSetting.body.data.individualTippingEnabled, false);

  const updateServiceAreaSetting = await requestJson<{
    data: {
      tippingMode: string;
      teamTippingEnabled: boolean;
      individualTippingEnabled: boolean;
    };
  }>("PATCH", `/customer-admin/tipping-settings/service-areas/${breakfastServiceArea.id}`, {
    token: adminToken,
    body: {
      tippingMode: "TEAM_OR_INDIVIDUAL",
      teamTippingEnabled: true,
      individualTippingEnabled: false,
    },
  });

  assert.equal(updateServiceAreaSetting.status, 200);
  assert.equal(updateServiceAreaSetting.body.data.individualTippingEnabled, false);

  const managerUpdateAttempt = await requestJson<{
    error: string;
  }>("PATCH", "/customer-admin/tipping-settings/departments/BREAKFAST", {
    token: managerToken,
    body: {
      qrTippingEnabled: false,
    },
  });

  assert.equal(managerUpdateAttempt.status, 403);
  assert.equal(managerUpdateAttempt.body.error, "FORBIDDEN");
});

test("customer admin can manage QR assets with venue and department filtering while managers remain blocked from writes", async () => {
  const adminToken = await login("manager@sharkclub.example", "Password123!");
  const managerToken = await login("ops@sharkclub.example", "Password123!");
  const breakfastServiceArea = await prisma.serviceArea.findFirstOrThrow({
    where: { slug: "breakfast-table-card" },
    select: { id: true, venueId: true, departmentId: true },
  });
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const createQrAsset = await requestJson<{
    data: {
      id: string;
      destinationType: string;
      venue: { id: string };
      department: { id: string } | null;
      targetUrl: string;
      printableAsset: { printName: string };
    };
  }>("POST", "/customer-admin/qr-assets", {
    token: adminToken,
    body: {
      venueId: breakfastServiceArea.venueId,
      departmentId: breakfastServiceArea.departmentId,
      serviceAreaId: breakfastServiceArea.id,
      slug: `breakfast-team-${suffix}`,
      destinationType: "TEAM",
      label: "Breakfast team QR",
      printName: "Breakfast Staff Card",
      displayMode: "TABLE_CARD",
      previewConfig: {
        size: "A6",
        includeLogo: true,
      },
    },
  });

  assert.equal(createQrAsset.status, 201);
  assert.equal(createQrAsset.body.data.destinationType, "TEAM");
  assert.ok(createQrAsset.body.data.targetUrl.includes(`/tip/breakfast-team-${suffix}`));
  assert.equal(createQrAsset.body.data.printableAsset.printName, "Breakfast Staff Card");

  const listFiltered = await requestJson<{
    data: {
      items: Array<{
        id: string;
        department: { id: string } | null;
        venue: { id: string };
      }>;
    };
  }>(
    "GET",
    `/customer-admin/qr-assets?venueId=${breakfastServiceArea.venueId}&departmentId=${breakfastServiceArea.departmentId}`,
    { token: adminToken },
  );

  assert.equal(listFiltered.status, 200);
  assert.ok(listFiltered.body.data.items.some((item) => item.id === createQrAsset.body.data.id));
  assert.ok(
    listFiltered.body.data.items.every(
      (item) =>
        item.venue.id === breakfastServiceArea.venueId &&
        item.department?.id === breakfastServiceArea.departmentId,
    ),
  );

  const managerCreateAttempt = await requestJson<{
    error: string;
  }>("POST", "/customer-admin/qr-assets", {
    token: managerToken,
    body: {
      venueId: breakfastServiceArea.venueId,
      departmentId: breakfastServiceArea.departmentId,
      serviceAreaId: breakfastServiceArea.id,
      slug: `manager-qr-${suffix}`,
      destinationType: "TEAM",
      label: "Manager blocked",
      printName: "Manager blocked",
      displayMode: "TABLE_CARD",
    },
  });

  assert.equal(managerCreateAttempt.status, 403);
  assert.equal(managerCreateAttempt.body.error, "FORBIDDEN");
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
      slug: "shark-club-newcastle",
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
  const emberCustomer = await prisma.customer.findFirstOrThrow({
    where: { slug: "ember-dining-co" },
    select: { id: true },
  });
  const emberVenue = await prisma.venue.findFirstOrThrow({
    where: {
      customerId: emberCustomer.id,
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

test("customer manager cannot create a service area against another customer's department", async () => {
  const token = await login("ops@sharkclub.example", "Password123!");
  const emberCustomer = await prisma.customer.findFirstOrThrow({
    where: { slug: "ember-dining-co" },
    select: { id: true },
  });
  const emberVenue = await prisma.venue.findFirstOrThrow({
    where: {
      customerId: emberCustomer.id,
    },
    select: { id: true },
  });
  const emberDepartment = await prisma.department.create({
    data: {
      customerId: emberCustomer.id,
      venueId: emberVenue.id,
      name: `Ember Breakfast ${Date.now()}`,
      slug: `ember-breakfast-${Date.now()}`,
      type: "BREAKFAST",
    },
  });

  const response = await requestJson<{
    error: string;
    message: string;
  }>("POST", "/customer-admin/service-areas", {
    token,
    body: {
      venueId: emberVenue.id,
      departmentId: emberDepartment.id,
      name: "Cross Tenant Card",
      slug: `cross-tenant-card-${Date.now()}`,
      tippingMode: "TEAM_ONLY",
      displayMode: "TABLE_CARD",
    },
  });

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "NOT_FOUND");
});

test("customer manager cannot create a staff member in another customer's venue", async () => {
  const token = await login("ops@sharkclub.example", "Password123!");
  const emberCustomer = await prisma.customer.findFirstOrThrow({
    where: { slug: "ember-dining-co" },
    select: { id: true },
  });
  const emberVenue = await prisma.venue.findFirstOrThrow({
    where: {
      customerId: emberCustomer.id,
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

test("customer manager cannot assign staff to a department from another venue", async () => {
  const token = await login("ops@sharkclub.example", "Password123!");
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const firstVenue = await requestJson<{ data: { id: string } }>("POST", "/customer-admin/venues", {
    token,
    body: {
      name: `Department Staff Primary ${suffix}`,
      slug: `department-staff-primary-${suffix}`,
    },
  });

  const secondVenue = await requestJson<{ data: { id: string } }>("POST", "/customer-admin/venues", {
    token,
    body: {
      name: `Department Staff Secondary ${suffix}`,
      slug: `department-staff-secondary-${suffix}`,
    },
  });

  const department = await requestJson<{ data: { id: string } }>(
    "POST",
    "/customer-admin/departments",
    {
      token,
      body: {
        venueId: secondVenue.body.data.id,
        name: `Breakfast Ops ${suffix}`,
        slug: `breakfast-ops-${suffix}`,
        type: "BREAKFAST",
      },
    },
  );

  assert.equal(department.status, 201);

  const response = await requestJson<{
    error: string;
    message: string;
  }>("POST", "/customer-admin/staff", {
    token,
    body: {
      venueId: firstVenue.body.data.id,
      departmentIds: [department.body.data.id],
      firstName: "Cross",
      lastName: "Department",
      displayName: "Cross Department",
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "VALIDATION_ERROR");
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
