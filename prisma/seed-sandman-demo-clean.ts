import {
  AllocationRecipientType,
  CustomerStatus,
  DisplayMode,
  IntegrationProvider,
  PayrollFrequency,
  PoolStatus,
  PoolType,
  PrismaClient,
  QrAssetDestinationType,
  QrDestinationType,
  ShiftStatus,
  StaffStatus,
  TipSelectionType,
  TipTransactionStatus,
  UserRole,
  VenueStatus,
  VenueType,
} from "@prisma/client";
import type { RevenueCentreType } from "../src/lib/revenue-centres";
import { hashPassword } from "../src/server/shared/auth/password";

type StaffSeed = {
  firstName: string;
  lastName: string;
  displayName: string;
  roleLabel: string;
  status: StaffStatus;
  staffCode: string;
  payrollRef: string;
  hoursWorked: number;
};

type CreatedStaff = StaffSeed & { id: string; venueId: string; departmentId: string };

function money(value: number) {
  return Number(value.toFixed(2));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function startOfUtcDay(date: Date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function startOfCurrentTuesdayFortnight(date: Date) {
  const start = startOfUtcDay(date);
  const daysSinceTuesday = (start.getUTCDay() + 5) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceTuesday);
  return start;
}

function weightedSplit(total: number, staff: Array<{ id: string; hoursWorked: number }>) {
  const totalCents = Math.round(total * 100);
  const totalWeight = staff.reduce((sum, member) => sum + member.hoursWorked, 0);
  let remainder = totalCents;

  return staff.map((member, index) => {
    const cents =
      index === staff.length - 1
        ? remainder
        : Math.round((totalCents * member.hoursWorked) / totalWeight);
    remainder -= cents;
    return { employeeId: member.id, amount: cents / 100 };
  });
}

async function seedRoles(prisma: PrismaClient) {
  const roles = [
    [UserRole.TIPIT_ADMIN, "Tipit Admin", "Platform-level administrator with access to all customers."],
    [UserRole.CUSTOMER_ADMIN, "Customer Admin", "Admin user for a single customer account."],
    [UserRole.CUSTOMER_MANAGER, "Customer Manager", "Manager user for operational changes within one customer."],
    [UserRole.CUSTOMER_VIEWER, "Customer Viewer", "Read-only user for one customer."],
  ] as const;

  for (const [code, name, description] of roles) {
    await prisma.role.upsert({ where: { code }, update: { name, description }, create: { code, name, description } });
  }
}

async function createDepartmentStaff(
  prisma: PrismaClient,
  input: { customerId: string; venueId: string; departmentId: string; members: StaffSeed[] },
) {
  const created: CreatedStaff[] = [];

  for (const member of input.members) {
    const staff = await prisma.staffMember.create({
      data: {
        customerId: input.customerId,
        venueId: input.venueId,
        firstName: member.firstName,
        lastName: member.lastName,
        displayName: member.displayName,
        email: `${member.firstName.toLowerCase()}@sandman.example`,
        status: member.status,
        staffCode: member.staffCode,
        payrollReference: member.payrollRef,
        externalPayrollRef: member.payrollRef,
        employmentStartAt: addDays(new Date(), -180),
      },
    });

    await prisma.departmentStaffAssignment.create({
      data: {
        customerId: input.customerId,
        venueId: input.venueId,
        departmentId: input.departmentId,
        staffMemberId: staff.id,
        isPrimary: true,
      },
    });

    created.push({ ...member, id: staff.id, venueId: input.venueId, departmentId: input.departmentId });
  }

  return created;
}

export async function seedSandmanCleanDemo(prisma: PrismaClient) {
  const passwordHash = await hashPassword("Password123!");
  const now = new Date();
  const currentPeriodStart = startOfCurrentTuesdayFortnight(now);
  const currentPeriodEnd = addHours(addDays(currentPeriodStart, 14), -0.001);
  const previousPeriodStart = addDays(currentPeriodStart, -14);
  const previousPeriodEnd = addHours(currentPeriodStart, -0.001);

  await prisma.auditLog.deleteMany();
  await prisma.allocationResult.deleteMany();
  await prisma.tipTransaction.deleteMany();
  await prisma.payrollExportLine.deleteMany();
  await prisma.payrollExportBatch.deleteMany();
  await prisma.importedServiceCharge.deleteMany();
  await prisma.importedHoursWorked.deleteMany();
  await prisma.tipOutPosting.deleteMany();
  await prisma.tipOutRule.deleteMany();
  await prisma.payrollPeriod.deleteMany();
  await prisma.payrollCalendar.deleteMany();
  await prisma.payrollConfig.deleteMany();
  await prisma.allocationRuleLine.deleteMany();
  await prisma.allocationRule.deleteMany();
  await prisma.allocationRuleTemplateLine.deleteMany();
  await prisma.allocationRuleTemplate.deleteMany();
  await prisma.shiftStaffAssignment.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.poolMember.deleteMany();
  await prisma.pool.deleteMany();
  await prisma.qrAsset.deleteMany();
  await prisma.serviceArea.deleteMany();
  await prisma.customerDepartmentTippingSetting.deleteMany();
  await prisma.departmentStaffAssignment.deleteMany();
  await prisma.department.deleteMany();
  await prisma.outletBrand.deleteMany();
  await prisma.staffMember.deleteMany();
  await prisma.customerUser.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.role.deleteMany();

  await seedRoles(prisma);

  await prisma.allocationRuleTemplate.createMany({
    data: [
      {
        slug: "team-pool-100",
        name: "100% team pool",
        description: "Routes all value into a team pool.",
        scope: "DEPARTMENT",
        selectionType: "TEAM",
        priority: 100,
        isActive: true,
        isRecommended: true,
      },
      {
        slug: "individual-only",
        name: "individual only",
        description: "Routes all value to the selected employee.",
        scope: "DEPARTMENT",
        selectionType: "INDIVIDUAL",
        priority: 100,
        isActive: true,
        isRecommended: true,
      },
      {
        slug: "team-and-individual-split",
        name: "team + individual split",
        description: "Splits value between the selected employee and a team pool.",
        scope: "DEPARTMENT",
        selectionType: "INDIVIDUAL",
        priority: 100,
        isActive: true,
        isRecommended: true,
      },
      {
        slug: "me-default-split",
        name: "M&E default split",
        description: "Default meetings and events team pool split.",
        scope: "DEPARTMENT",
        selectionType: "TEAM",
        priority: 100,
        isActive: true,
        isRecommended: true,
      },
    ],
  });

  const templates = await prisma.allocationRuleTemplate.findMany({
    where: {
      slug: {
        in: ["team-pool-100", "individual-only", "team-and-individual-split", "me-default-split"],
      },
    },
    select: {
      id: true,
      slug: true,
    },
  });
  const templateIdBySlug = new Map(templates.map((template) => [template.slug, template.id]));

  await prisma.allocationRuleTemplateLine.createMany({
    data: [
      {
        allocationRuleTemplateId: templateIdBySlug.get("team-pool-100")!,
        recipientType: AllocationRecipientType.POOL,
        percentageBps: 10000,
        sortOrder: 1,
      },
      {
        allocationRuleTemplateId: templateIdBySlug.get("individual-only")!,
        recipientType: AllocationRecipientType.SELECTED_STAFF,
        percentageBps: 10000,
        sortOrder: 1,
      },
      {
        allocationRuleTemplateId: templateIdBySlug.get("team-and-individual-split")!,
        recipientType: AllocationRecipientType.SELECTED_STAFF,
        percentageBps: 8000,
        sortOrder: 1,
      },
      {
        allocationRuleTemplateId: templateIdBySlug.get("team-and-individual-split")!,
        recipientType: AllocationRecipientType.POOL,
        percentageBps: 2000,
        sortOrder: 2,
      },
      {
        allocationRuleTemplateId: templateIdBySlug.get("me-default-split")!,
        recipientType: AllocationRecipientType.POOL,
        percentageBps: 10000,
        sortOrder: 1,
      },
    ],
  });

  const [tipitAdminRole, customerAdminRole, customerManagerRole, customerViewerRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { code: UserRole.TIPIT_ADMIN } }),
    prisma.role.findUniqueOrThrow({ where: { code: UserRole.CUSTOMER_ADMIN } }),
    prisma.role.findUniqueOrThrow({ where: { code: UserRole.CUSTOMER_MANAGER } }),
    prisma.role.findUniqueOrThrow({ where: { code: UserRole.CUSTOMER_VIEWER } }),
  ]);

  await prisma.user.create({
    data: {
      email: "platform-admin@tipit.example",
      passwordHash,
      firstName: "Tia",
      lastName: "Porter",
      platformRoleId: tipitAdminRole.id,
    },
  });

  const customer = await prisma.customer.create({
    data: {
      name: "Sandman Hospitality Group",
      slug: "sandman-hospitality-group",
      legalName: "Sandman Hospitality Group Ltd",
      contactEmail: "finance@sandman.example",
      contactPhone: "+44 20 5550 1188",
      status: CustomerStatus.ACTIVE,
      tipitFeeBps: 475,
      currency: "GBP",
      timezone: "Europe/London",
    },
  });

  const [adminUser, managerUser, viewerUser] = await Promise.all([
    prisma.user.create({ data: { email: "admin@sandman.example", passwordHash, firstName: "Sophie", lastName: "Murray" } }),
    prisma.user.create({ data: { email: "manager@sandman.example", passwordHash, firstName: "Connor", lastName: "Lane" } }),
    prisma.user.create({ data: { email: "viewer@sandman.example", passwordHash, firstName: "Holly", lastName: "Evans" } }),
  ]);

  const [customerAdmin, customerManager, customerViewer] = await Promise.all([
    prisma.customerUser.create({ data: { customerId: customer.id, userId: adminUser.id, roleId: customerAdminRole.id } }),
    prisma.customerUser.create({ data: { customerId: customer.id, userId: managerUser.id, roleId: customerManagerRole.id } }),
    prisma.customerUser.create({ data: { customerId: customer.id, userId: viewerUser.id, roleId: customerViewerRole.id } }),
  ]);

  const payrollCalendar = await prisma.payrollCalendar.create({
    data: {
      customerId: customer.id,
      startDate: previousPeriodStart,
      startDayOfWeek: 2,
      periodsPerYear: 26,
      periodLengthDays: 14,
      timezone: customer.timezone,
    },
  });

  await prisma.payrollConfig.create({
    data: {
      customerId: customer.id,
      frequency: PayrollFrequency.FORTNIGHTLY,
      settlementFrequency: "FORTNIGHTLY",
      payPeriodAnchor: currentPeriodStart,
      payrollCalendarId: payrollCalendar.id,
      settlementDay: 2,
      exportEmail: "payroll@sandman.example",
      notes: "Fortnightly payroll from Tuesday to Monday for the demo venue.",
    },
  });

  const [previousPeriod, currentPeriod] = await Promise.all([
    prisma.payrollPeriod.create({
      data: {
        customerId: customer.id,
        payrollCalendarId: payrollCalendar.id,
        frequency: PayrollFrequency.FORTNIGHTLY,
        label: "Previous Payroll Period",
        year: previousPeriodStart.getUTCFullYear(),
        periodNumber: 7,
        startDate: previousPeriodStart,
        endDate: previousPeriodEnd,
        startsAt: previousPeriodStart,
        endsAt: previousPeriodEnd,
      },
    }),
    prisma.payrollPeriod.create({
      data: {
        customerId: customer.id,
        payrollCalendarId: payrollCalendar.id,
        frequency: PayrollFrequency.FORTNIGHTLY,
        label: "Current Payroll Period",
        year: currentPeriodStart.getUTCFullYear(),
        periodNumber: 8,
        startDate: currentPeriodStart,
        endDate: currentPeriodEnd,
        startsAt: currentPeriodStart,
        endsAt: currentPeriodEnd,
      },
    }),
  ]);

  const venue = await prisma.venue.create({
    data: {
      customerId: customer.id,
      name: "Sandman Signature Newcastle",
      slug: "sandman-signature-newcastle",
      code: "SSN-001",
      type: VenueType.OTHER,
      description: "Client demo venue for breakfast and room service tipping.",
      address: "Gallowgate, Newcastle upon Tyne, NE1 4SD",
      timezone: "Europe/London",
      status: VenueStatus.ACTIVE,
      addressLine1: "Gallowgate",
      city: "Newcastle upon Tyne",
      postcode: "NE1 4SD",
      country: "GB",
      brandBackgroundColor: "#857868",
      brandTextColor: "#FFF8F1",
      brandButtonColor: "#B39D88",
      brandButtonTextColor: "#FFFFFF",
      brandLogoImageUrl: "/sandman-signature-hotel-586x390.jpg",
    },
  });

  const [sandmanBrand, sharkClubBrand] = await Promise.all([
    prisma.outletBrand.create({
      data: {
        customerId: customer.id,
        venueId: venue.id,
        name: "sandman-signature",
        displayName: "Sandman Signature",
        logoUrl: "/sandman-signature-hotel-586x390.jpg",
      },
    }),
    prisma.outletBrand.create({
      data: {
        customerId: customer.id,
        venueId: venue.id,
        name: "shark-club",
        displayName: "Shark Club",
        logoUrl: null,
      },
    }),
  ]);

  const [breakfastDepartment, roomServiceDepartment, barDepartment, restaurantDepartment, meetingsDepartment] =
    await Promise.all([
      prisma.department.create({
        data: {
          customerId: customer.id,
          venueId: venue.id,
          outletBrandId: sharkClubBrand.id,
          name: "Breakfast",
          slug: "breakfast",
          revenueCentreType: "BREAKFAST" satisfies RevenueCentreType,
          description: "Breakfast dining room and host team.",
          isActive: true,
        },
      }),
      prisma.department.create({
        data: {
          customerId: customer.id,
          venueId: venue.id,
          outletBrandId: sharkClubBrand.id,
          name: "Room Service",
          slug: "room-service",
          revenueCentreType: "ROOM_SERVICE" satisfies RevenueCentreType,
          description: "In-room dining attendants and supervisors.",
          isActive: true,
        },
      }),
      prisma.department.create({
        data: {
          customerId: customer.id,
          venueId: venue.id,
          outletBrandId: sharkClubBrand.id,
          name: "Bar",
          slug: "bar",
          revenueCentreType: "BAR" satisfies RevenueCentreType,
          description: "Disabled for the demo rollout.",
          isActive: false,
        },
      }),
      prisma.department.create({
        data: {
          customerId: customer.id,
          venueId: venue.id,
          outletBrandId: sharkClubBrand.id,
          name: "Restaurant",
          slug: "restaurant",
          revenueCentreType: "RESTAURANT" satisfies RevenueCentreType,
          description: "Disabled for the demo rollout.",
          isActive: false,
        },
      }),
      prisma.department.create({
        data: {
          customerId: customer.id,
          venueId: venue.id,
          outletBrandId: sandmanBrand.id,
          name: "Meetings & Events",
          slug: "meetings-events",
          revenueCentreType: "MEETINGS_EVENTS" satisfies RevenueCentreType,
          description: "Disabled for the demo rollout.",
          isActive: false,
        },
      }),
    ]);

  await prisma.customerDepartmentTippingSetting.createMany({
    data: [
      { customerId: customer.id, revenueCentreType: "BREAKFAST" satisfies RevenueCentreType, qrTippingEnabled: true, teamTippingEnabled: true, individualTippingEnabled: true, shiftSelectorEnabled: true },
      { customerId: customer.id, revenueCentreType: "ROOM_SERVICE" satisfies RevenueCentreType, qrTippingEnabled: true, teamTippingEnabled: true, individualTippingEnabled: false, shiftSelectorEnabled: false },
      { customerId: customer.id, revenueCentreType: "BAR" satisfies RevenueCentreType, qrTippingEnabled: false, teamTippingEnabled: false, individualTippingEnabled: false, shiftSelectorEnabled: false },
      { customerId: customer.id, revenueCentreType: "RESTAURANT" satisfies RevenueCentreType, qrTippingEnabled: false, teamTippingEnabled: false, individualTippingEnabled: false, shiftSelectorEnabled: false },
      { customerId: customer.id, revenueCentreType: "MEETINGS_EVENTS" satisfies RevenueCentreType, qrTippingEnabled: false, teamTippingEnabled: false, individualTippingEnabled: false, shiftSelectorEnabled: false },
    ],
  });

  const breakfastStaff = await createDepartmentStaff(prisma, {
    customerId: customer.id,
    venueId: venue.id,
    departmentId: breakfastDepartment.id,
    members: [
      { firstName: "Emma", lastName: "Turner", displayName: "Emma", roleLabel: "Server", status: StaffStatus.ACTIVE, staffCode: "SSN-BRK-001", payrollRef: "BRK-1001", hoursWorked: 42 },
      { firstName: "Josh", lastName: "Patel", displayName: "Josh", roleLabel: "Barista", status: StaffStatus.ACTIVE, staffCode: "SSN-BRK-002", payrollRef: "BRK-1002", hoursWorked: 36 },
      { firstName: "Maria", lastName: "Rossi", displayName: "Maria", roleLabel: "Supervisor", status: StaffStatus.ACTIVE, staffCode: "SSN-BRK-003", payrollRef: "BRK-1003", hoursWorked: 34 },
      { firstName: "Liam", lastName: "Murphy", displayName: "Liam", roleLabel: "Runner", status: StaffStatus.ACTIVE, staffCode: "SSN-BRK-004", payrollRef: "BRK-1004", hoursWorked: 28 },
      { firstName: "Sophie", lastName: "Cole", displayName: "Sophie", roleLabel: "Server", status: StaffStatus.ACTIVE, staffCode: "SSN-BRK-005", payrollRef: "BRK-1005", hoursWorked: 18 },
      { firstName: "Olivia", lastName: "Hayes", displayName: "Olivia", roleLabel: "Server", status: StaffStatus.INACTIVE, staffCode: "SSN-BRK-006", payrollRef: "BRK-1006", hoursWorked: 0 },
    ],
  });

  const roomServiceStaff = await createDepartmentStaff(prisma, {
    customerId: customer.id,
    venueId: venue.id,
    departmentId: roomServiceDepartment.id,
    members: [
      { firstName: "Alex", lastName: "Shaw", displayName: "Alex", roleLabel: "Room Service Attendant", status: StaffStatus.ACTIVE, staffCode: "SSN-RS-001", payrollRef: "RS-2001", hoursWorked: 31 },
      { firstName: "Ben", lastName: "Cross", displayName: "Ben", roleLabel: "Room Service Attendant", status: StaffStatus.ACTIVE, staffCode: "SSN-RS-002", payrollRef: "RS-2002", hoursWorked: 27 },
      { firstName: "Chloe", lastName: "Walsh", displayName: "Chloe", roleLabel: "Supervisor", status: StaffStatus.ACTIVE, staffCode: "SSN-RS-003", payrollRef: "RS-2003", hoursWorked: 24 },
      { firstName: "Dan", lastName: "Boyd", displayName: "Dan", roleLabel: "Room Service Attendant", status: StaffStatus.INACTIVE, staffCode: "SSN-RS-004", payrollRef: "RS-2004", hoursWorked: 0 },
    ],
  });

  const breakfastByName = Object.fromEntries(breakfastStaff.map((staff) => [staff.firstName, staff])) as Record<string, CreatedStaff>;
  const roomServiceByName = Object.fromEntries(roomServiceStaff.map((staff) => [staff.firstName, staff])) as Record<string, CreatedStaff>;

  const [tableCardA, tableCardB, hostStand, trayCard, inRoomCard] = await Promise.all([
    prisma.serviceArea.create({
      data: {
        customerId: customer.id,
        venueId: venue.id,
        departmentId: breakfastDepartment.id,
        name: "Breakfast Table Card A",
        slug: "ssn-breakfast-table-card-a",
        description: "Table-side breakfast QR card for the main dining section.",
        tippingMode: "TEAM_OR_INDIVIDUAL",
        displayMode: DisplayMode.TABLE_CARD,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
      },
    }),
    prisma.serviceArea.create({
      data: {
        customerId: customer.id,
        venueId: venue.id,
        departmentId: breakfastDepartment.id,
        name: "Breakfast Table Card B",
        slug: "ssn-breakfast-table-card-b",
        description: "Table-side breakfast QR card for the window section.",
        tippingMode: "TEAM_OR_INDIVIDUAL",
        displayMode: DisplayMode.TABLE_CARD,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
      },
    }),
    prisma.serviceArea.create({
      data: {
        customerId: customer.id,
        venueId: venue.id,
        departmentId: breakfastDepartment.id,
        name: "Breakfast Host Stand",
        slug: "ssn-breakfast-host-stand",
        description: "Host stand QR for walk-in breakfast guests.",
        tippingMode: "TEAM_OR_INDIVIDUAL",
        displayMode: DisplayMode.TABLE_CARD,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
      },
    }),
    prisma.serviceArea.create({
      data: {
        customerId: customer.id,
        venueId: venue.id,
        departmentId: roomServiceDepartment.id,
        name: "Room Service Tray Card",
        slug: "ssn-room-service-tray-card",
        description: "Tray card included with in-room dining deliveries.",
        tippingMode: "TEAM_ONLY",
        displayMode: DisplayMode.TABLE_CARD,
        teamTippingEnabled: true,
        individualTippingEnabled: false,
      },
    }),
    prisma.serviceArea.create({
      data: {
        customerId: customer.id,
        venueId: venue.id,
        departmentId: roomServiceDepartment.id,
        name: "Room Service In-Room Card",
        slug: "ssn-room-service-in-room-card",
        description: "In-room bedside card for room service tipping.",
        tippingMode: "TEAM_ONLY",
        displayMode: DisplayMode.TABLE_CARD,
        teamTippingEnabled: true,
        individualTippingEnabled: false,
      },
    }),
  ]);

  await prisma.qrAsset.createMany({
    data: [
      [tableCardA.id, breakfastDepartment.id, "qr-ssn-breakfast-table-card-a", "Breakfast Table Card A QR", "Breakfast Table Card A"],
      [tableCardB.id, breakfastDepartment.id, "qr-ssn-breakfast-table-card-b", "Breakfast Table Card B QR", "Breakfast Table Card B"],
      [hostStand.id, breakfastDepartment.id, "qr-ssn-breakfast-host-stand", "Breakfast Host Stand QR", "Breakfast Host Stand"],
      [trayCard.id, roomServiceDepartment.id, "qr-ssn-room-service-tray-card", "Room Service Tray Card QR", "Room Service Tray Card"],
      [inRoomCard.id, roomServiceDepartment.id, "qr-ssn-room-service-in-room-card", "Room Service In-Room Card QR", "Room Service In-Room Card"],
    ].map(([serviceAreaId, departmentId, slug, label, printName]) => ({
      customerId: customer.id,
      venueId: venue.id,
      departmentId,
      serviceAreaId,
      slug,
      destinationType: QrAssetDestinationType.SERVICE_AREA,
      label,
      printName,
      displayMode: DisplayMode.TABLE_CARD,
    })),
  });

  const [breakfastPool, roomServicePool, bohPool] = await Promise.all([
    prisma.pool.create({
      data: {
        customerId: customer.id,
        venueId: venue.id,
        name: "Breakfast Team Pool",
        slug: "breakfast-team-pool",
        description: "Front-of-house breakfast pool for shared team tips.",
        poolType: PoolType.FOH,
        status: PoolStatus.ACTIVE,
      },
    }),
    prisma.pool.create({
      data: {
        customerId: customer.id,
        venueId: venue.id,
        name: "Room Service Team Pool",
        slug: "room-service-team-pool",
        description: "Front-of-house room service team pool.",
        poolType: PoolType.FOH,
        status: PoolStatus.ACTIVE,
      },
    }),
    prisma.pool.create({
      data: {
        customerId: customer.id,
        venueId: venue.id,
        name: "BOH Support Pool",
        slug: "boh-support-pool",
        description: "Back-of-house support pool retained for future demo expansion.",
        poolType: PoolType.BOH,
        status: PoolStatus.ACTIVE,
      },
    }),
  ]);

  await prisma.poolMember.createMany({
    data: [
      ...breakfastStaff.filter((staff) => staff.status === StaffStatus.ACTIVE).map((staff) => ({ poolId: breakfastPool.id, staffMemberId: staff.id })),
      ...roomServiceStaff.filter((staff) => staff.status === StaffStatus.ACTIVE).map((staff) => ({ poolId: roomServicePool.id, staffMemberId: staff.id })),
      { poolId: bohPool.id, staffMemberId: breakfastByName.Josh.id },
      { poolId: bohPool.id, staffMemberId: breakfastByName.Liam.id },
      { poolId: bohPool.id, staffMemberId: roomServiceByName.Ben.id },
    ],
  });

  await prisma.tipOutRule.create({
    data: {
      customerId: customer.id,
      scope: "DEPARTMENT",
      venueId: venue.id,
      departmentId: breakfastDepartment.id,
      targetPoolId: bohPool.id,
      name: "Breakfast server tip-out to BOH support",
      description: "Deducts 1.5% of net breakfast sales and transfers it into the BOH Support Pool for payroll distribution.",
      rateDecimal: 0.015,
      capAtAvailableTipBalance: true,
      isActive: true,
      effectiveFrom: currentPeriodStart,
    },
  });

  await prisma.allocationRule.createMany({
    data: [
      {
        venueId: venue.id,
        departmentId: breakfastDepartment.id,
        scope: "DEPARTMENT",
        selectionType: "TEAM",
        name: "Breakfast team to pool",
        description: "Routes breakfast team tips 100% into the Breakfast Team Pool.",
        priority: 200,
        isActive: true,
        effectiveFrom: currentPeriodStart,
      },
      {
        venueId: venue.id,
        departmentId: breakfastDepartment.id,
        scope: "DEPARTMENT",
        selectionType: "INDIVIDUAL",
        name: "Breakfast individual to selected staff",
        description: "Routes breakfast individual tips 100% to the selected employee.",
        priority: 220,
        isActive: true,
        effectiveFrom: currentPeriodStart,
      },
      {
        venueId: venue.id,
        departmentId: roomServiceDepartment.id,
        scope: "DEPARTMENT",
        selectionType: "TEAM",
        name: "Room service team to pool",
        description: "Routes room service team tips 100% into the Room Service Team Pool.",
        priority: 200,
        isActive: true,
        effectiveFrom: currentPeriodStart,
      },
    ],
  });

  const rules = await prisma.allocationRule.findMany({
    where: { venueId: venue.id },
    select: { id: true, name: true },
  });
  const ruleIdByName = new Map(rules.map((rule) => [rule.name, rule.id]));

  await prisma.allocationRuleLine.createMany({
    data: [
      {
        allocationRuleId: ruleIdByName.get("Breakfast team to pool")!,
        recipientType: AllocationRecipientType.POOL,
        poolId: breakfastPool.id,
        percentageBps: 10000,
        sortOrder: 1,
      },
      {
        allocationRuleId: ruleIdByName.get("Breakfast individual to selected staff")!,
        recipientType: AllocationRecipientType.SELECTED_STAFF,
        percentageBps: 10000,
        sortOrder: 1,
      },
      {
        allocationRuleId: ruleIdByName.get("Room service team to pool")!,
        recipientType: AllocationRecipientType.POOL,
        poolId: roomServicePool.id,
        percentageBps: 10000,
        sortOrder: 1,
      },
    ],
  });

  const [breakfastActiveShift, roomServiceActiveShift, upcomingShift, completedShift] = await Promise.all([
    prisma.shift.create({
      data: {
        customerId: customer.id,
        venueId: venue.id,
        departmentId: breakfastDepartment.id,
        name: "Breakfast Live Shift",
        timezone: "Europe/London",
        startsAt: currentPeriodStart,
        endsAt: currentPeriodEnd,
        status: ShiftStatus.ACTIVE,
      },
    }),
    prisma.shift.create({
      data: {
        customerId: customer.id,
        venueId: venue.id,
        departmentId: roomServiceDepartment.id,
        name: "Room Service Live Shift",
        timezone: "Europe/London",
        startsAt: currentPeriodStart,
        endsAt: currentPeriodEnd,
        status: ShiftStatus.ACTIVE,
      },
    }),
    prisma.shift.create({
      data: {
        customerId: customer.id,
        venueId: venue.id,
        departmentId: breakfastDepartment.id,
        name: "Breakfast Upcoming Shift",
        timezone: "Europe/London",
        startsAt: addHours(addDays(now, 1), 6),
        endsAt: addHours(addDays(now, 1), 12),
        status: ShiftStatus.SCHEDULED,
      },
    }),
    prisma.shift.create({
      data: {
        customerId: customer.id,
        venueId: venue.id,
        departmentId: roomServiceDepartment.id,
        name: "Room Service Completed Shift",
        timezone: "Europe/London",
        startsAt: addHours(addDays(now, -1), -2),
        endsAt: addHours(addDays(now, -1), 4),
        status: ShiftStatus.COMPLETED,
      },
    }),
  ]);

  await prisma.shiftStaffAssignment.createMany({
    data: [
      { shiftId: breakfastActiveShift.id, staffMemberId: breakfastByName.Emma.id, role: "Server", eligibleForTips: true },
      { shiftId: breakfastActiveShift.id, staffMemberId: breakfastByName.Josh.id, role: "Barista", eligibleForTips: true },
      { shiftId: breakfastActiveShift.id, staffMemberId: breakfastByName.Maria.id, role: "Supervisor", eligibleForTips: true },
      { shiftId: breakfastActiveShift.id, staffMemberId: breakfastByName.Liam.id, role: "Runner", eligibleForTips: true },
      { shiftId: roomServiceActiveShift.id, staffMemberId: roomServiceByName.Alex.id, role: "Room Service Attendant", eligibleForTips: true },
      { shiftId: roomServiceActiveShift.id, staffMemberId: roomServiceByName.Ben.id, role: "Room Service Attendant", eligibleForTips: true },
      { shiftId: roomServiceActiveShift.id, staffMemberId: roomServiceByName.Chloe.id, role: "Supervisor", eligibleForTips: true },
      { shiftId: upcomingShift.id, staffMemberId: breakfastByName.Sophie.id, role: "Server", eligibleForTips: true },
      { shiftId: completedShift.id, staffMemberId: roomServiceByName.Alex.id, role: "Room Service Attendant", eligibleForTips: true },
    ],
  });

  const activeBreakfastMembers = breakfastStaff.filter((staff) => staff.status === StaffStatus.ACTIVE);
  const activeRoomServiceMembers = roomServiceStaff.filter((staff) => staff.status === StaffStatus.ACTIVE);
  const successfulTransactions: SuccessfulSeedTransaction[] = [];
  const breakfastAmounts = [2, 5, 10, 5, 2];
  const breakfastRotation = [
    breakfastByName.Emma,
    breakfastByName.Emma,
    breakfastByName.Maria,
    breakfastByName.Emma,
    breakfastByName.Josh,
    breakfastByName.Emma,
    breakfastByName.Liam,
  ];

  for (let index = 0; index < 25; index += 1) {
    const serviceArea = [tableCardA, tableCardB, hostStand][index % 3];
    const isIndividual = index % 4 !== 0;
    const selectedEmployee = isIndividual ? breakfastRotation[index % breakfastRotation.length] : null;
    successfulTransactions.push({
      qrCodeSlug: serviceArea.slug,
      venueId: venue.id,
      serviceAreaId: serviceArea.id,
      destinationPoolId: isIndividual ? null : breakfastPool.id,
      destinationEmployeeId: selectedEmployee?.id ?? null,
      destinationType: QrDestinationType.SERVICE_AREA,
      guestSelectionType: isIndividual ? "INDIVIDUAL" : "TEAM",
      grossAmount: breakfastAmounts[index % breakfastAmounts.length],
      occurredAt: addHours(addDays(currentPeriodStart, index % 10), 7 + (index % 4)),
      rating: selectedEmployee?.firstName === "Emma" ? 5 : index % 3 === 0 ? 4 : 5,
      payrollPeriodId: currentPeriod.id,
      poolMembers: isIndividual ? null : activeBreakfastMembers,
      selectedEmployee,
      comment: selectedEmployee?.firstName === "Emma" ? "Emma made breakfast service feel effortless." : undefined,
    });
  }

  const roomServiceAmounts = [5, 10, 5, 10, 10];
  for (let index = 0; index < 10; index += 1) {
    const serviceArea = index % 2 === 0 ? trayCard : inRoomCard;
    successfulTransactions.push({
      qrCodeSlug: serviceArea.slug,
      venueId: venue.id,
      serviceAreaId: serviceArea.id,
      destinationPoolId: roomServicePool.id,
      destinationEmployeeId: null,
      destinationType: QrDestinationType.SERVICE_AREA,
      guestSelectionType: "TEAM",
      grossAmount: roomServiceAmounts[index % roomServiceAmounts.length],
      occurredAt: addHours(addDays(currentPeriodStart, index % 8), 18 + (index % 3)),
      rating: index % 2 === 0 ? 5 : 4,
      payrollPeriodId: currentPeriod.id,
      poolMembers: activeRoomServiceMembers,
      selectedEmployee: null,
      comment: index % 3 === 0 ? "Quick delivery and everything arrived hot." : undefined,
    });
  }

  for (const transaction of successfulTransactions) {
    const grossAmount = money(transaction.grossAmount);
    const tipitFeeAmount = money(grossAmount * 0.0475);
    const netAmount = money(grossAmount - tipitFeeAmount);
    const tipTransaction = await prisma.tipTransaction.create({
      data: {
        customerId: customer.id,
        venueId: transaction.venueId,
        payrollPeriodId: transaction.payrollPeriodId,
        qrCodeSlug: transaction.qrCodeSlug,
        destinationType: transaction.destinationType,
        destinationEmployeeId: transaction.destinationEmployeeId,
        destinationPoolId: transaction.destinationPoolId,
        destinationVenueId: transaction.venueId,
        destinationServiceAreaId: transaction.serviceAreaId,
        guestSelectionType: transaction.guestSelectionType,
        currency: customer.currency,
        grossAmount,
        tipitFeeAmount,
        netAmount,
        status: TipTransactionStatus.SUCCEEDED,
        rating: transaction.rating,
        comment: transaction.comment,
        ratedAt: transaction.occurredAt,
        reviewIntegrationStatus: transaction.rating >= 4 ? "ELIGIBLE" : "NOT_REQUESTED",
        occurredAt: transaction.occurredAt,
        stripeCheckoutId: `demo_${transaction.qrCodeSlug}_${transaction.occurredAt.getTime()}`,
      },
    });

    if (transaction.guestSelectionType === "INDIVIDUAL" && transaction.selectedEmployee) {
      await prisma.allocationResult.create({
        data: {
          customerId: customer.id,
          venueId: transaction.venueId,
          payrollPeriodId: transaction.payrollPeriodId,
          tipTransactionId: tipTransaction.id,
          employeeId: transaction.selectedEmployee.id,
          poolId: null,
          grossAmount,
          netAmount,
        },
      });
      continue;
    }

    if (transaction.poolMembers && transaction.destinationPoolId) {
      const grossSplit = weightedSplit(grossAmount, transaction.poolMembers);
      const netSplit = weightedSplit(netAmount, transaction.poolMembers);
      await prisma.allocationResult.createMany({
        data: grossSplit.map((grossShare, index) => ({
          customerId: customer.id,
          venueId: transaction.venueId,
          payrollPeriodId: transaction.payrollPeriodId,
          tipTransactionId: tipTransaction.id,
          employeeId: grossShare.employeeId,
          poolId: transaction.destinationPoolId,
          grossAmount: grossShare.amount,
          netAmount: netSplit[index]?.amount ?? 0,
        })),
      });
    }
  }

  for (const staff of [...breakfastStaff, ...roomServiceStaff].filter((member) => member.hoursWorked > 0)) {
    const portions = staff.hoursWorked > 30 ? [0.5, 0.3, 0.2] : [0.6, 0.4];
    let remaining = staff.hoursWorked;
    for (let index = 0; index < portions.length; index += 1) {
      const hours = index === portions.length - 1 ? remaining : money(staff.hoursWorked * portions[index]);
      remaining = money(remaining - hours);
      const workDate = addDays(currentPeriodStart, (index * 2 + staff.firstName.length) % 10);
      await prisma.importedHoursWorked.create({
        data: {
          customerId: customer.id,
          venueId: staff.venueId,
          departmentId: staff.departmentId,
          staffMemberId: staff.id,
          integrationProvider: IntegrationProvider.AMEEGO,
          externalRecordRef: `${staff.payrollRef}-${index + 1}`,
          sourceSystemName: "Ameego",
          status: "SUCCEEDED",
          workDate,
          shiftStartsAt: addHours(workDate, 6 + index),
          shiftEndsAt: addHours(workDate, 6 + index + Math.max(hours, 4)),
          hoursWorked: hours,
          rawPayload: { demo: true, staffCode: staff.staffCode },
        },
      });
    }
  }

  await prisma.auditLog.createMany({
    data: [
      { userId: adminUser.id, customerId: customer.id, customerUserId: customerAdmin.id, venueId: venue.id, entityType: "ServiceArea", entityId: tableCardA.id, action: "service-area.created", summary: "Created Breakfast Table Card A for the breakfast journey." },
      { userId: adminUser.id, customerId: customer.id, customerUserId: customerAdmin.id, venueId: venue.id, entityType: "ServiceArea", entityId: trayCard.id, action: "service-area.created", summary: "Created Room Service Tray Card for team tipping." },
      { userId: managerUser.id, customerId: customer.id, customerUserId: customerManager.id, venueId: venue.id, entityType: "Shift", entityId: breakfastActiveShift.id, action: "shift.started", summary: "Started the breakfast demo shift." },
      { userId: managerUser.id, customerId: customer.id, customerUserId: customerManager.id, venueId: venue.id, entityType: "Shift", entityId: roomServiceActiveShift.id, action: "shift.started", summary: "Started the room service demo shift." },
      { userId: viewerUser.id, customerId: customer.id, customerUserId: customerViewer.id, venueId: venue.id, entityType: "QrAsset", entityId: hostStand.id, action: "qr.previewed", summary: "Viewed the Breakfast Host Stand QR configuration." },
    ],
  });

  console.log("Seeded clean Sandman Hospitality Group demo dataset.");
  console.log(`Venue: ${venue.name}`);
  console.log(`Periods: ${previousPeriod.label}, ${currentPeriod.label}`);
  console.log("Departments enabled: Breakfast, Room Service. Disabled: Bar, Restaurant, Meetings & Events.");
  console.log("Public URLs: /tip/ssn-breakfast-table-card-a, /tip/ssn-breakfast-table-card-b, /tip/ssn-breakfast-host-stand, /tip/ssn-room-service-tray-card, /tip/ssn-room-service-in-room-card");
  console.log("Credentials: admin@sandman.example / Password123!, manager@sandman.example / Password123!, viewer@sandman.example / Password123!");
}
