import { PrismaClient } from "@prisma/client";

import { seedSandmanCleanDemo } from "./seed-sandman-demo-clean";

const prisma = new PrismaClient();

async function main() {
  await seedSandmanCleanDemo(prisma);
}

main()
  .catch((error) => {
    console.error("Failed to seed database", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/*
import {
  AllocationRecipientType,
  CustomerStatus,
  DepartmentType,
  DisplayMode,
  NoActiveShiftBehavior,
  PayrollFrequency,
  PoolStatus,
  PrismaClient,
  QrDestinationType,
  StaffStatus,
  SettlementFrequency,
  ShiftStatus,
  TippingMode,
  TipTransactionStatus,
  UserRole,
  VenueType,
  VenueStatus,
} from "@prisma/client";
import { hashPassword } from "../src/server/shared/auth/password";
import { seedSandmanPilotDemo } from "./seed-sandman-pilot";

const prisma = new PrismaClient();

async function seedRoles() {
  const definitions = [
    {
      code: UserRole.TIPIT_ADMIN,
      name: "Tipit Admin",
      description: "Platform-level administrator with access to all customers.",
    },
    {
      code: UserRole.CUSTOMER_ADMIN,
      name: "Customer Admin",
      description: "Admin user for a single customer account.",
    },
    {
      code: UserRole.CUSTOMER_MANAGER,
      name: "Customer Manager",
      description: "Manager user for operational changes within one customer.",
    },
    {
      code: UserRole.CUSTOMER_VIEWER,
      name: "Customer Viewer",
      description: "Read-only user for one customer.",
    },
  ];

  for (const definition of definitions) {
    await prisma.role.upsert({
      where: { code: definition.code },
      update: definition,
      create: definition,
    });
  }
}

function asMoney(value: number) {
  return Number(value.toFixed(2));
}

function splitAmount(value: number, percentage: number) {
  return asMoney(value * percentage);
}

function findPeriodId(
  periods: Array<{ id: string; startsAt: Date; endsAt: Date }>,
  occurredAt: Date,
) {
  const period = periods.find((candidate) => occurredAt >= candidate.startsAt && occurredAt <= candidate.endsAt);
  return period?.id ?? null;
}

async function main() {
  await seedSandmanPilotDemo(prisma);
  return;

  const demoPasswordHash = await hashPassword("Password123!");

  await prisma.auditLog.deleteMany();
  await prisma.allocationResult.deleteMany();
  await prisma.tipTransaction.deleteMany();
  await prisma.payrollPeriod.deleteMany();
  await prisma.allocationRuleLine.deleteMany();
  await prisma.allocationRule.deleteMany();
  await prisma.shiftStaffAssignment.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.poolMember.deleteMany();
  await prisma.pool.deleteMany();
  await prisma.qrAsset.deleteMany();
  await prisma.serviceArea.deleteMany();
  await prisma.customerDepartmentTippingSetting.deleteMany();
  await prisma.departmentStaffAssignment.deleteMany();
  await prisma.department.deleteMany();
  await prisma.staffMember.deleteMany();
  await prisma.payrollConfig.deleteMany();
  await prisma.customerUser.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.role.deleteMany();

  await seedRoles();

  const [tipitAdminRole, customerAdminRole, customerManagerRole, customerViewerRole] =
    await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: UserRole.TIPIT_ADMIN } }),
      prisma.role.findUniqueOrThrow({ where: { code: UserRole.CUSTOMER_ADMIN } }),
      prisma.role.findUniqueOrThrow({ where: { code: UserRole.CUSTOMER_MANAGER } }),
      prisma.role.findUniqueOrThrow({ where: { code: UserRole.CUSTOMER_VIEWER } }),
    ]);

  const tipitAdmin = await prisma.user.create({
    data: {
      email: "platform-admin@tipit.example",
      passwordHash: demoPasswordHash,
      firstName: "Tia",
      lastName: "Porter",
      platformRoleId: tipitAdminRole.id,
    },
  });

  const sharkClub = await prisma.customer.create({
    data: {
      name: "Shark Club UK",
      slug: "shark-club-uk",
      legalName: "Shark Club Newcastle Limited",
      contactEmail: "newcastle@sharkclub.example",
      contactPhone: "+44 191 555 0123",
      status: CustomerStatus.ACTIVE,
      tipitFeeBps: 500,
      currency: "GBP",
      timezone: "Europe/London",
    },
  });

  const emberDining = await prisma.customer.create({
    data: {
      name: "Ember Dining Co",
      slug: "ember-dining-co",
      legalName: "Ember Dining Company Ltd",
      contactEmail: "finance@ember.example",
      contactPhone: "+44 161 555 0108",
      status: CustomerStatus.ACTIVE,
      tipitFeeBps: 450,
      currency: "GBP",
      timezone: "Europe/London",
    },
  });

  await prisma.payrollConfig.createMany({
    data: [
      {
        customerId: sharkClub.id,
        frequency: PayrollFrequency.WEEKLY,
        settlementFrequency: SettlementFrequency.WEEKLY,
        payPeriodAnchor: new Date("2026-01-05T00:00:00.000Z"),
        settlementDay: 2,
        exportEmail: "payroll@sharkclub.example",
        notes: "Weekly export to the central payroll team every Tuesday.",
      },
      {
        customerId: emberDining.id,
        frequency: PayrollFrequency.FORTNIGHTLY,
        settlementFrequency: SettlementFrequency.WEEKLY,
        payPeriodAnchor: new Date("2026-01-12T00:00:00.000Z"),
        settlementDay: 5,
        exportEmail: "ops@ember.example",
        notes: "Fortnightly manager review before payroll export.",
      },
    ],
  });

  const [sharkPeriods, emberPeriods] = await Promise.all([
    prisma.$transaction([
      prisma.payrollPeriod.create({
        data: {
          customerId: sharkClub.id,
          frequency: PayrollFrequency.WEEKLY,
          label: "24 Feb - 2 Mar 2026",
          startsAt: new Date("2026-02-24T00:00:00.000Z"),
          endsAt: new Date("2026-03-02T23:59:59.999Z"),
        },
      }),
      prisma.payrollPeriod.create({
        data: {
          customerId: sharkClub.id,
          frequency: PayrollFrequency.WEEKLY,
          label: "3 Mar - 9 Mar 2026",
          startsAt: new Date("2026-03-03T00:00:00.000Z"),
          endsAt: new Date("2026-03-09T23:59:59.999Z"),
        },
      }),
      prisma.payrollPeriod.create({
        data: {
          customerId: sharkClub.id,
          frequency: PayrollFrequency.WEEKLY,
          label: "10 Mar - 16 Mar 2026",
          startsAt: new Date("2026-03-10T00:00:00.000Z"),
          endsAt: new Date("2026-03-16T23:59:59.999Z"),
        },
      }),
      prisma.payrollPeriod.create({
        data: {
          customerId: sharkClub.id,
          frequency: PayrollFrequency.WEEKLY,
          label: "17 Mar - 23 Mar 2026",
          startsAt: new Date("2026-03-17T00:00:00.000Z"),
          endsAt: new Date("2026-03-23T23:59:59.999Z"),
        },
      }),
    ]),
    prisma.$transaction([
      prisma.payrollPeriod.create({
        data: {
          customerId: emberDining.id,
          frequency: PayrollFrequency.FORTNIGHTLY,
          label: "17 Feb - 2 Mar 2026",
          startsAt: new Date("2026-02-17T00:00:00.000Z"),
          endsAt: new Date("2026-03-02T23:59:59.999Z"),
        },
      }),
      prisma.payrollPeriod.create({
        data: {
          customerId: emberDining.id,
          frequency: PayrollFrequency.FORTNIGHTLY,
          label: "3 Mar - 16 Mar 2026",
          startsAt: new Date("2026-03-03T00:00:00.000Z"),
          endsAt: new Date("2026-03-16T23:59:59.999Z"),
        },
      }),
      prisma.payrollPeriod.create({
        data: {
          customerId: emberDining.id,
          frequency: PayrollFrequency.FORTNIGHTLY,
          label: "17 Mar - 30 Mar 2026",
          startsAt: new Date("2026-03-17T00:00:00.000Z"),
          endsAt: new Date("2026-03-30T23:59:59.999Z"),
        },
      }),
    ]),
  ]);

  const sharkAdminUser = await prisma.user.create({
    data: {
      email: "manager@sharkclub.example",
      passwordHash: demoPasswordHash,
      firstName: "Megan",
      lastName: "Taylor",
    },
  });

  const sharkManagerUser = await prisma.user.create({
    data: {
      email: "ops@sharkclub.example",
      passwordHash: demoPasswordHash,
      firstName: "Jordan",
      lastName: "Reeves",
    },
  });

  const emberAdminUser = await prisma.user.create({
    data: {
      email: "admin@ember.example",
      passwordHash: demoPasswordHash,
      firstName: "Ava",
      lastName: "Bose",
    },
  });

  const emberViewerUser = await prisma.user.create({
    data: {
      email: "viewer@ember.example",
      passwordHash: demoPasswordHash,
      firstName: "Nina",
      lastName: "Cole",
    },
  });

  const [sharkCustomerAdmin, sharkCustomerManager, emberCustomerAdmin, emberCustomerViewer] =
    await Promise.all([
      prisma.customerUser.create({
        data: {
          customerId: sharkClub.id,
          userId: sharkAdminUser.id,
          roleId: customerAdminRole.id,
        },
      }),
      prisma.customerUser.create({
        data: {
          customerId: sharkClub.id,
          userId: sharkManagerUser.id,
          roleId: customerManagerRole.id,
        },
      }),
      prisma.customerUser.create({
        data: {
          customerId: emberDining.id,
          userId: emberAdminUser.id,
          roleId: customerAdminRole.id,
        },
      }),
      prisma.customerUser.create({
        data: {
          customerId: emberDining.id,
          userId: emberViewerUser.id,
          roleId: customerViewerRole.id,
        },
      }),
    ]);

  const [sharkNewcastle, sharkManchester, emberLeeds] = await Promise.all([
    prisma.venue.create({
      data: {
        customerId: sharkClub.id,
        name: "Shark Club Newcastle",
        slug: "shark-club-newcastle",
        code: "SC-NEW",
        type: VenueType.HOTEL_BAR,
        description: "Flagship sports bar and late-night hospitality venue.",
        address: "The Gate, Newgate Street, Newcastle upon Tyne, NE1 5TG",
        timezone: "Europe/London",
        status: VenueStatus.ACTIVE,
        addressLine1: "The Gate",
        city: "Newcastle upon Tyne",
        postcode: "NE1 5TG",
        country: "GB",
        brandBackgroundColor: "#ECECEC",
        brandTextColor: "#111111",
        brandButtonColor: "#000000",
        brandButtonTextColor: "#FFFFFF",
      },
    }),
    prisma.venue.create({
      data: {
        customerId: sharkClub.id,
        name: "Shark Club Manchester",
        slug: "shark-club-manchester",
        code: "SC-MAN",
        type: VenueType.HOTEL_BAR,
        description: "Regional pilot venue for the Tipit rollout.",
        address: "10 Exchange Square, Manchester, M4 3TR",
        timezone: "Europe/London",
        status: VenueStatus.INACTIVE,
        addressLine1: "10 Exchange Square",
        city: "Manchester",
        postcode: "M4 3TR",
        country: "GB",
      },
    }),
    prisma.venue.create({
      data: {
        customerId: emberDining.id,
        name: "Ember Leeds",
        slug: "ember-leeds",
        code: "EMB-LDS",
        type: VenueType.RESTAURANT,
        description: "Neighbourhood restaurant and cocktail bar.",
        address: "18 Park Row, Leeds, LS1 5JA",
        timezone: "Europe/London",
        status: VenueStatus.ACTIVE,
        addressLine1: "18 Park Row",
        city: "Leeds",
        postcode: "LS1 5JA",
        country: "GB",
      },
    }),
  ]);

  const [maya, tom, aisha, luca, nina] = await Promise.all([
    prisma.staffMember.create({
      data: {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        firstName: "Maya",
        lastName: "Patel",
        displayName: "Maya",
        email: "maya@sharkclub.example",
        payrollReference: "SCN-EMP-001",
        status: StaffStatus.ACTIVE,
        employmentStartAt: new Date("2025-08-01T00:00:00.000Z"),
      },
    }),
    prisma.staffMember.create({
      data: {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        firstName: "Tom",
        lastName: "Reeves",
        displayName: "Tom",
        email: "tom@sharkclub.example",
        payrollReference: "SCN-EMP-002",
        status: StaffStatus.ACTIVE,
        employmentStartAt: new Date("2025-09-15T00:00:00.000Z"),
      },
    }),
    prisma.staffMember.create({
      data: {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        firstName: "Aisha",
        lastName: "Khan",
        displayName: "Aisha",
        email: "aisha@sharkclub.example",
        payrollReference: "SCN-EMP-003",
        status: StaffStatus.ACTIVE,
        employmentStartAt: new Date("2025-10-10T00:00:00.000Z"),
      },
    }),
    prisma.staffMember.create({
      data: {
        customerId: emberDining.id,
        venueId: emberLeeds.id,
        firstName: "Luca",
        lastName: "Morris",
        displayName: "Luca",
        email: "luca@ember.example",
        payrollReference: "EMB-EMP-001",
        status: StaffStatus.ACTIVE,
        employmentStartAt: new Date("2025-07-01T00:00:00.000Z"),
      },
    }),
    prisma.staffMember.create({
      data: {
        customerId: emberDining.id,
        venueId: emberLeeds.id,
        firstName: "Nina",
        lastName: "Bose",
        displayName: "Nina",
        email: "nina@ember.example",
        payrollReference: "EMB-EMP-002",
        status: StaffStatus.ACTIVE,
        employmentStartAt: new Date("2025-11-03T00:00:00.000Z"),
      },
    }),
  ]);

  const [sharkFloorPool, emberFloorPool] = await Promise.all([
    prisma.pool.create({
      data: {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        name: "Floor Team Pool",
        slug: "floor-team-pool",
        description: "Shared pool for the floor team during live events.",
        status: PoolStatus.ACTIVE,
      },
    }),
    prisma.pool.create({
      data: {
        customerId: emberDining.id,
        venueId: emberLeeds.id,
        name: "Service Pool",
        slug: "service-pool",
        description: "Front-of-house shared service pool.",
        status: PoolStatus.ACTIVE,
      },
    }),
  ]);

  await prisma.poolMember.createMany({
    data: [
      {
        poolId: sharkFloorPool.id,
        staffMemberId: maya.id,
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        poolId: sharkFloorPool.id,
        staffMemberId: tom.id,
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        poolId: sharkFloorPool.id,
        staffMemberId: aisha.id,
        joinedAt: new Date("2026-01-15T00:00:00.000Z"),
      },
      {
        poolId: emberFloorPool.id,
        staffMemberId: luca.id,
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        poolId: emberFloorPool.id,
        staffMemberId: nina.id,
        joinedAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    ],
  });

  const [sharkBreakfastDepartment, sharkBarDepartment, emberRestaurantDepartment] =
    await Promise.all([
      prisma.department.create({
        data: {
          customerId: sharkClub.id,
          venueId: sharkNewcastle.id,
          name: "Breakfast",
          slug: "breakfast",
          type: DepartmentType.BREAKFAST,
          description: "Morning breakfast service team.",
        },
      }),
      prisma.department.create({
        data: {
          customerId: sharkClub.id,
          venueId: sharkNewcastle.id,
          name: "Bar",
          slug: "bar",
          type: DepartmentType.BAR,
          description: "Main bar and table drinks service.",
        },
      }),
      prisma.department.create({
        data: {
          customerId: emberDining.id,
          venueId: emberLeeds.id,
          name: "Restaurant",
          slug: "restaurant",
          type: DepartmentType.RESTAURANT,
          description: "Core restaurant floor team.",
        },
      }),
    ]);

  await prisma.departmentStaffAssignment.createMany({
    data: [
      {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        departmentId: sharkBreakfastDepartment.id,
        staffMemberId: maya.id,
        isPrimary: true,
      },
      {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        departmentId: sharkBreakfastDepartment.id,
        staffMemberId: tom.id,
        isPrimary: true,
      },
      {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        departmentId: sharkBarDepartment.id,
        staffMemberId: tom.id,
      },
      {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        departmentId: sharkBarDepartment.id,
        staffMemberId: aisha.id,
        isPrimary: true,
      },
      {
        customerId: emberDining.id,
        venueId: emberLeeds.id,
        departmentId: emberRestaurantDepartment.id,
        staffMemberId: luca.id,
        isPrimary: true,
      },
      {
        customerId: emberDining.id,
        venueId: emberLeeds.id,
        departmentId: emberRestaurantDepartment.id,
        staffMemberId: nina.id,
        isPrimary: true,
      },
    ],
  });

  await prisma.customerDepartmentTippingSetting.createMany({
    data: [
      {
        customerId: sharkClub.id,
        departmentType: DepartmentType.BREAKFAST,
        qrTippingEnabled: true,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
        shiftSelectorEnabled: true,
      },
      {
        customerId: sharkClub.id,
        departmentType: DepartmentType.MEETING_EVENTS,
        qrTippingEnabled: true,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
        shiftSelectorEnabled: true,
      },
      {
        customerId: sharkClub.id,
        departmentType: DepartmentType.ROOM_SERVICE,
        qrTippingEnabled: true,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
        shiftSelectorEnabled: true,
      },
      {
        customerId: sharkClub.id,
        departmentType: DepartmentType.BAR,
        qrTippingEnabled: false,
        teamTippingEnabled: true,
        individualTippingEnabled: false,
        shiftSelectorEnabled: false,
      },
      {
        customerId: sharkClub.id,
        departmentType: DepartmentType.RESTAURANT,
        qrTippingEnabled: false,
        teamTippingEnabled: true,
        individualTippingEnabled: false,
        shiftSelectorEnabled: false,
      },
      {
        customerId: emberDining.id,
        departmentType: DepartmentType.RESTAURANT,
        qrTippingEnabled: true,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
        shiftSelectorEnabled: false,
      },
    ],
  });

  await prisma.serviceArea.createMany({
    data: [
      {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        departmentId: sharkBreakfastDepartment.id,
        name: "Breakfast Table Card",
        slug: "breakfast-table-card",
        description: "Breakfast service QR card for table-side tipping.",
        tippingMode: TippingMode.SHIFT_SELECTOR,
        displayMode: DisplayMode.TABLE_CARD,
        noActiveShiftBehavior: NoActiveShiftBehavior.FALLBACK_TO_TEAM,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
      },
      {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        departmentId: sharkBarDepartment.id,
        name: "Fixed Bar QR",
        slug: "fixed-bar-qr",
        description: "Fixed QR sign placed on the main bar.",
        tippingMode: TippingMode.TEAM_OR_INDIVIDUAL,
        displayMode: DisplayMode.COUNTER_SIGN,
        noActiveShiftBehavior: NoActiveShiftBehavior.DISABLE_INDIVIDUAL,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
      },
      {
        customerId: emberDining.id,
        venueId: emberLeeds.id,
        departmentId: emberRestaurantDepartment.id,
        name: "Bill Folder QR",
        slug: "bill-folder-qr",
        description: "Restaurant bill folder QR prompt.",
        tippingMode: TippingMode.INDIVIDUAL_ONLY,
        displayMode: DisplayMode.BILL_FOLDER,
        noActiveShiftBehavior: NoActiveShiftBehavior.FALLBACK_TO_TEAM,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
      },
    ],
  });

  const [breakfastServiceArea, barServiceArea, emberBillFolder] = await Promise.all([
    prisma.serviceArea.findFirstOrThrow({
      where: { venueId: sharkNewcastle.id, slug: "breakfast-table-card" },
      select: { id: true, departmentId: true },
    }),
    prisma.serviceArea.findFirstOrThrow({
      where: { venueId: sharkNewcastle.id, slug: "fixed-bar-qr" },
      select: { id: true, departmentId: true },
    }),
    prisma.serviceArea.findFirstOrThrow({
      where: { venueId: emberLeeds.id, slug: "bill-folder-qr" },
      select: { id: true, departmentId: true },
    }),
  ]);

  await prisma.qrAsset.createMany({
    data: [
      {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        departmentId: breakfastServiceArea.departmentId,
        serviceAreaId: breakfastServiceArea.id,
        slug: "newcastle-breakfast-team",
        destinationType: "SERVICE_AREA",
        label: "Breakfast area team QR",
        printName: "Breakfast Table Card",
        displayMode: DisplayMode.TABLE_CARD,
      },
      {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        departmentId: breakfastServiceArea.departmentId,
        serviceAreaId: breakfastServiceArea.id,
        slug: "newcastle-event-space-team",
        destinationType: "TEAM",
        label: "Event space team QR",
        printName: "M&E Event Sign",
        displayMode: DisplayMode.EVENT_SIGN,
      },
      {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        departmentId: breakfastServiceArea.departmentId,
        serviceAreaId: breakfastServiceArea.id,
        staffMemberId: maya.id,
        slug: "newcastle-breakfast-maya",
        destinationType: "STAFF_MEMBER",
        label: "Breakfast host staff QR",
        printName: "Breakfast Team Member Card",
        displayMode: DisplayMode.TABLE_CARD,
      },
      {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        departmentId: barServiceArea.departmentId,
        serviceAreaId: barServiceArea.id,
        slug: "newcastle-bar-counter",
        destinationType: "SERVICE_AREA",
        label: "Bar counter QR",
        printName: "Bar Counter Sign",
        displayMode: DisplayMode.COUNTER_SIGN,
      },
      {
        customerId: emberDining.id,
        venueId: emberLeeds.id,
        departmentId: emberBillFolder.departmentId,
        serviceAreaId: emberBillFolder.id,
        slug: "ember-bill-folder",
        destinationType: "SERVICE_AREA",
        label: "Bill folder QR",
        printName: "Bill Folder Insert",
        displayMode: DisplayMode.BILL_FOLDER,
      },
    ],
  });

  await prisma.shift.createMany({
    data: [
      {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        departmentId: sharkBreakfastDepartment.id,
        name: "Breakfast Service",
        timezone: "Europe/London",
        startsAt: new Date("2026-04-02T06:00:00.000Z"),
        endsAt: new Date("2026-04-02T12:00:00.000Z"),
        status: ShiftStatus.ACTIVE,
      },
      {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        departmentId: sharkBarDepartment.id,
        name: "Late Bar",
        timezone: "Europe/London",
        startsAt: new Date("2026-04-02T17:00:00.000Z"),
        endsAt: new Date("2026-04-03T01:00:00.000Z"),
        status: ShiftStatus.ACTIVE,
      },
      {
        customerId: emberDining.id,
        venueId: emberLeeds.id,
        departmentId: emberRestaurantDepartment.id,
        name: "Dinner Service",
        timezone: "Europe/London",
        startsAt: new Date("2026-04-02T17:00:00.000Z"),
        endsAt: new Date("2026-04-02T23:00:00.000Z"),
        status: ShiftStatus.ACTIVE,
      },
    ],
  });

  const [breakfastShift, barShift, emberDinnerShift] = await Promise.all([
    prisma.shift.findFirstOrThrow({
      where: { venueId: sharkNewcastle.id, departmentId: sharkBreakfastDepartment.id, name: "Breakfast Service" },
    }),
    prisma.shift.findFirstOrThrow({
      where: { venueId: sharkNewcastle.id, departmentId: sharkBarDepartment.id, name: "Late Bar" },
    }),
    prisma.shift.findFirstOrThrow({
      where: { venueId: emberLeeds.id, departmentId: emberRestaurantDepartment.id, name: "Dinner Service" },
    }),
  ]);

  await prisma.shiftStaffAssignment.createMany({
    data: [
      {
        shiftId: breakfastShift.id,
        staffMemberId: maya.id,
        role: "Breakfast lead",
        eligibleForTips: true,
      },
      {
        shiftId: breakfastShift.id,
        staffMemberId: tom.id,
        role: "Breakfast host",
        eligibleForTips: true,
      },
      {
        shiftId: barShift.id,
        staffMemberId: aisha.id,
        role: "Bar lead",
        eligibleForTips: true,
      },
      {
        shiftId: barShift.id,
        staffMemberId: tom.id,
        role: "Bar support",
        eligibleForTips: false,
      },
      {
        shiftId: emberDinnerShift.id,
        staffMemberId: luca.id,
        role: "Floor manager",
        eligibleForTips: true,
      },
      {
        shiftId: emberDinnerShift.id,
        staffMemberId: nina.id,
        role: "Section lead",
        eligibleForTips: true,
      },
    ],
  });

  const [sharkRule, emberRule] = await Promise.all([
    prisma.allocationRule.create({
      data: {
        venueId: sharkNewcastle.id,
        name: "Main floor split",
        description: "Default split between Maya and the active floor pool.",
        priority: 100,
        isActive: true,
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        lines: {
          create: [
            {
              recipientType: AllocationRecipientType.STAFF,
              staffMemberId: maya.id,
              percentageBps: 7000,
              sortOrder: 1,
            },
            {
              recipientType: AllocationRecipientType.POOL,
              poolId: sharkFloorPool.id,
              percentageBps: 3000,
              sortOrder: 2,
            },
          ],
        },
      },
      include: { lines: true },
    }),
    prisma.allocationRule.create({
      data: {
        venueId: emberLeeds.id,
        name: "Service equaliser",
        description: "Even split between Luca and the service pool.",
        priority: 100,
        isActive: true,
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        lines: {
          create: [
            {
              recipientType: AllocationRecipientType.STAFF,
              staffMemberId: luca.id,
              percentageBps: 5000,
              sortOrder: 1,
            },
            {
              recipientType: AllocationRecipientType.POOL,
              poolId: emberFloorPool.id,
              percentageBps: 5000,
              sortOrder: 2,
            },
          ],
        },
      },
      include: { lines: true },
    }),
  ]);

  await prisma.auditLog.createMany({
    data: [
      {
        userId: tipitAdmin.id,
        entityType: "Customer",
        entityId: sharkClub.id,
        action: "customer.created",
        summary: "Created Shark Club UK customer account.",
        afterData: {
          status: sharkClub.status,
          tipitFeeBps: sharkClub.tipitFeeBps,
        },
      },
      {
        userId: sharkAdminUser.id,
        customerId: sharkClub.id,
        customerUserId: sharkCustomerAdmin.id,
        entityType: "Venue",
        entityId: sharkNewcastle.id,
        action: "venue.created",
        summary: "Created Shark Club Newcastle venue.",
        afterData: {
          name: sharkNewcastle.name,
          status: sharkNewcastle.status,
        },
      },
      {
        userId: sharkManagerUser.id,
        customerId: sharkClub.id,
        customerUserId: sharkCustomerManager.id,
        entityType: "AllocationRule",
        entityId: sharkRule.id,
        action: "allocation-rule.created",
        summary: "Created main floor split rule.",
        afterData: {
          lineCount: sharkRule.lines.length,
          priority: sharkRule.priority,
        },
      },
      {
        userId: emberAdminUser.id,
        customerId: emberDining.id,
        customerUserId: emberCustomerAdmin.id,
        entityType: "PayrollConfig",
        entityId: emberDining.id,
        action: "payroll-config.updated",
        summary: "Configured fortnightly payroll export.",
        metadata: {
          frequency: PayrollFrequency.FORTNIGHTLY,
          exportEmail: "ops@ember.example",
        },
      },
      {
        userId: emberViewerUser.id,
        customerId: emberDining.id,
        customerUserId: emberCustomerViewer.id,
        entityType: "Pool",
        entityId: emberFloorPool.id,
        action: "pool.viewed",
        summary: "Viewed pool membership history.",
      },
    ],
  });

  const sharkTransactions = [
    { occurredAt: new Date("2026-02-26T19:30:00.000Z"), grossAmount: 24, destinationType: QrDestinationType.EMPLOYEE, employeeId: maya.id },
    { occurredAt: new Date("2026-02-28T21:05:00.000Z"), grossAmount: 16, destinationType: QrDestinationType.POOL, employeeId: null },
    { occurredAt: new Date("2026-03-04T22:10:00.000Z"), grossAmount: 38, destinationType: QrDestinationType.EMPLOYEE, employeeId: maya.id },
    { occurredAt: new Date("2026-03-07T18:45:00.000Z"), grossAmount: 12, destinationType: QrDestinationType.VENUE, employeeId: null },
    { occurredAt: new Date("2026-03-12T20:20:00.000Z"), grossAmount: 42, destinationType: QrDestinationType.EMPLOYEE, employeeId: tom.id },
    { occurredAt: new Date("2026-03-15T23:05:00.000Z"), grossAmount: 28, destinationType: QrDestinationType.POOL, employeeId: null },
    { occurredAt: new Date("2026-03-18T19:15:00.000Z"), grossAmount: 34, destinationType: QrDestinationType.EMPLOYEE, employeeId: maya.id },
    { occurredAt: new Date("2026-03-20T21:55:00.000Z"), grossAmount: 18, destinationType: QrDestinationType.VENUE, employeeId: null },
  ];

  for (const transaction of sharkTransactions) {
    const grossAmount = asMoney(transaction.grossAmount);
    const tipitFeeAmount = splitAmount(grossAmount, 0.05);
    const netAmount = asMoney(grossAmount - tipitFeeAmount);
    const payrollPeriodId = findPeriodId(sharkPeriods, transaction.occurredAt);

    const tipTransaction = await prisma.tipTransaction.create({
      data: {
        customerId: sharkClub.id,
        venueId: sharkNewcastle.id,
        payrollPeriodId,
        qrCodeSlug: transaction.destinationType === QrDestinationType.EMPLOYEE ? "maya-table-qr" : "shark-club-team",
        destinationType: transaction.destinationType,
        destinationEmployeeId: transaction.employeeId,
        destinationPoolId:
          transaction.destinationType === QrDestinationType.POOL ? sharkFloorPool.id : null,
        destinationVenueId: sharkNewcastle.id,
        currency: sharkClub.currency,
        grossAmount,
        tipitFeeAmount,
        netAmount,
        status: TipTransactionStatus.SUCCEEDED,
        occurredAt: transaction.occurredAt,
      },
    });

    const mayaNet = splitAmount(netAmount, 0.8);
    const tomNet = splitAmount(netAmount, 0.1);
    const aishaNet = asMoney(netAmount - mayaNet - tomNet);

    const mayaGross = splitAmount(grossAmount, 0.8);
    const tomGross = splitAmount(grossAmount, 0.1);
    const aishaGross = asMoney(grossAmount - mayaGross - tomGross);

    await prisma.allocationResult.createMany({
      data: [
        {
          customerId: sharkClub.id,
          venueId: sharkNewcastle.id,
          payrollPeriodId,
          tipTransactionId: tipTransaction.id,
          employeeId: maya.id,
          poolId: null,
          grossAmount: mayaGross,
          netAmount: mayaNet,
        },
        {
          customerId: sharkClub.id,
          venueId: sharkNewcastle.id,
          payrollPeriodId,
          tipTransactionId: tipTransaction.id,
          employeeId: tom.id,
          poolId: sharkFloorPool.id,
          grossAmount: tomGross,
          netAmount: tomNet,
        },
        {
          customerId: sharkClub.id,
          venueId: sharkNewcastle.id,
          payrollPeriodId,
          tipTransactionId: tipTransaction.id,
          employeeId: aisha.id,
          poolId: sharkFloorPool.id,
          grossAmount: aishaGross,
          netAmount: aishaNet,
        },
      ],
    });
  }

  const emberTransactions = [
    { occurredAt: new Date("2026-02-20T19:10:00.000Z"), grossAmount: 22, destinationType: QrDestinationType.VENUE },
    { occurredAt: new Date("2026-02-27T20:25:00.000Z"), grossAmount: 31, destinationType: QrDestinationType.EMPLOYEE },
    { occurredAt: new Date("2026-03-05T18:55:00.000Z"), grossAmount: 26, destinationType: QrDestinationType.POOL },
    { occurredAt: new Date("2026-03-09T21:20:00.000Z"), grossAmount: 19, destinationType: QrDestinationType.VENUE },
    { occurredAt: new Date("2026-03-19T20:40:00.000Z"), grossAmount: 44, destinationType: QrDestinationType.EMPLOYEE },
    { occurredAt: new Date("2026-03-25T19:35:00.000Z"), grossAmount: 29, destinationType: QrDestinationType.POOL },
  ];

  for (const transaction of emberTransactions) {
    const grossAmount = asMoney(transaction.grossAmount);
    const tipitFeeAmount = splitAmount(grossAmount, 0.045);
    const netAmount = asMoney(grossAmount - tipitFeeAmount);
    const payrollPeriodId = findPeriodId(emberPeriods, transaction.occurredAt);

    const tipTransaction = await prisma.tipTransaction.create({
      data: {
        customerId: emberDining.id,
        venueId: emberLeeds.id,
        payrollPeriodId,
        qrCodeSlug: "ember-service",
        destinationType: transaction.destinationType,
        destinationEmployeeId: luca.id,
        destinationPoolId: emberFloorPool.id,
        destinationVenueId: emberLeeds.id,
        currency: emberDining.currency,
        grossAmount,
        tipitFeeAmount,
        netAmount,
        status: TipTransactionStatus.SUCCEEDED,
        occurredAt: transaction.occurredAt,
      },
    });

    const lucaNet = splitAmount(netAmount, 0.75);
    const ninaNet = asMoney(netAmount - lucaNet);
    const lucaGross = splitAmount(grossAmount, 0.75);
    const ninaGross = asMoney(grossAmount - lucaGross);

    await prisma.allocationResult.createMany({
      data: [
        {
          customerId: emberDining.id,
          venueId: emberLeeds.id,
          payrollPeriodId,
          tipTransactionId: tipTransaction.id,
          employeeId: luca.id,
          poolId: null,
          grossAmount: lucaGross,
          netAmount: lucaNet,
        },
        {
          customerId: emberDining.id,
          venueId: emberLeeds.id,
          payrollPeriodId,
          tipTransactionId: tipTransaction.id,
          employeeId: nina.id,
          poolId: emberFloorPool.id,
          grossAmount: ninaGross,
          netAmount: ninaNet,
        },
      ],
    });
  }

  const sandmanHospitality = await prisma.customer.create({
    data: {
      name: "Sandman Hospitality Group",
      slug: "sandman-hospitality-group",
      legalName: "Sandman Hospitality Group UK Ltd",
      contactEmail: "finance@sandman.example",
      contactPhone: "+44 191 555 0177",
      status: CustomerStatus.ACTIVE,
      tipitFeeBps: 475,
      currency: "GBP",
      timezone: "Europe/London",
    },
  });

  await prisma.payrollConfig.create({
    data: {
      customerId: sandmanHospitality.id,
      frequency: PayrollFrequency.WEEKLY,
      settlementFrequency: SettlementFrequency.WEEKLY,
      payPeriodAnchor: new Date("2026-03-30T00:00:00.000Z"),
      settlementDay: 3,
      exportEmail: "payroll@sandman.example",
      notes: "Pilot rollout for M&E, Breakfast, and Room Service only.",
    },
  });

  const sandmanCurrentPeriod = await prisma.payrollPeriod.create({
    data: {
      customerId: sandmanHospitality.id,
      frequency: PayrollFrequency.WEEKLY,
      label: "30 Mar - 5 Apr 2026",
      startsAt: new Date("2026-03-30T00:00:00.000Z"),
      endsAt: new Date("2026-04-05T23:59:59.999Z"),
    },
  });

  const [sandmanAdminUser, sandmanManagerUser, sandmanViewerUser] = await Promise.all([
    prisma.user.create({
      data: {
        email: "pilot.admin@sandman.example",
        passwordHash: demoPasswordHash,
        firstName: "Sophie",
        lastName: "Murray",
      },
    }),
    prisma.user.create({
      data: {
        email: "pilot.manager@sandman.example",
        passwordHash: demoPasswordHash,
        firstName: "Connor",
        lastName: "Lane",
      },
    }),
    prisma.user.create({
      data: {
        email: "pilot.viewer@sandman.example",
        passwordHash: demoPasswordHash,
        firstName: "Holly",
        lastName: "Evans",
      },
    }),
  ]);

  const [sandmanCustomerAdmin, sandmanCustomerManager, sandmanCustomerViewer] = await Promise.all([
    prisma.customerUser.create({
      data: {
        customerId: sandmanHospitality.id,
        userId: sandmanAdminUser.id,
        roleId: customerAdminRole.id,
      },
    }),
    prisma.customerUser.create({
      data: {
        customerId: sandmanHospitality.id,
        userId: sandmanManagerUser.id,
        roleId: customerManagerRole.id,
      },
    }),
    prisma.customerUser.create({
      data: {
        customerId: sandmanHospitality.id,
        userId: sandmanViewerUser.id,
        roleId: customerViewerRole.id,
      },
    }),
  ]);

  const [sandmanHotel, sandmanSharkClub] = await Promise.all([
    prisma.venue.create({
      data: {
        customerId: sandmanHospitality.id,
        name: "Sandman Hotel Newcastle",
        slug: "sandman-hotel-newcastle",
        code: "SDM-NEW",
        type: VenueType.OTHER,
        description: "Pilot hotel venue covering M&E, breakfast, and room service tipping journeys.",
        address: "Gallowgate, Newcastle upon Tyne, NE1 4SD",
        timezone: "Europe/London",
        status: VenueStatus.ACTIVE,
        addressLine1: "Gallowgate",
        city: "Newcastle upon Tyne",
        postcode: "NE1 4SD",
        country: "GB",
        brandBackgroundColor: "#F7F2E8",
        brandTextColor: "#161616",
        brandButtonColor: "#111111",
        brandButtonTextColor: "#FFFFFF",
      },
    }),
    prisma.venue.create({
      data: {
        customerId: sandmanHospitality.id,
        name: "Shark Club at Sandman Newcastle",
        slug: "sandman-shark-club-newcastle",
        code: "SDM-SC-NEW",
        type: VenueType.HOTEL_BAR,
        description: "Future rollout venue for bar and restaurant journeys, disabled by default for pilot launch.",
        address: "Gallowgate, Newcastle upon Tyne, NE1 4SD",
        timezone: "Europe/London",
        status: VenueStatus.ACTIVE,
        addressLine1: "Gallowgate",
        city: "Newcastle upon Tyne",
        postcode: "NE1 4SD",
        country: "GB",
      },
    }),
  ]);

  const [katherine, peter, olivia, daniel, morgan, leah, reece] = await Promise.all([
    prisma.staffMember.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        firstName: "Katherine",
        lastName: "Bell",
        displayName: "Katherine",
        email: "katherine@sandman.example",
        payrollReference: "SDM-EMP-001",
        status: StaffStatus.ACTIVE,
        employmentStartAt: new Date("2025-09-01T00:00:00.000Z"),
      },
    }),
    prisma.staffMember.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        firstName: "Peter",
        lastName: "Dunn",
        displayName: "Peter",
        email: "peter@sandman.example",
        payrollReference: "SDM-EMP-002",
        status: StaffStatus.ACTIVE,
        employmentStartAt: new Date("2025-09-15T00:00:00.000Z"),
      },
    }),
    prisma.staffMember.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        firstName: "Olivia",
        lastName: "Ross",
        displayName: "Olivia",
        email: "olivia@sandman.example",
        payrollReference: "SDM-EMP-003",
        status: StaffStatus.ACTIVE,
        employmentStartAt: new Date("2025-10-01T00:00:00.000Z"),
      },
    }),
    prisma.staffMember.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        firstName: "Daniel",
        lastName: "Hart",
        displayName: "Daniel",
        email: "daniel@sandman.example",
        payrollReference: "SDM-EMP-004",
        status: StaffStatus.ACTIVE,
        employmentStartAt: new Date("2025-11-10T00:00:00.000Z"),
      },
    }),
    prisma.staffMember.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        firstName: "Morgan",
        lastName: "Shaw",
        displayName: "Morgan",
        email: "morgan@sandman.example",
        payrollReference: "SDM-EMP-005",
        status: StaffStatus.ACTIVE,
        employmentStartAt: new Date("2025-08-15T00:00:00.000Z"),
      },
    }),
    prisma.staffMember.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        firstName: "Leah",
        lastName: "Cross",
        displayName: "Leah",
        email: "leah@sandman.example",
        payrollReference: "SDM-EMP-006",
        status: StaffStatus.ACTIVE,
        employmentStartAt: new Date("2025-12-01T00:00:00.000Z"),
      },
    }),
    prisma.staffMember.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanSharkClub.id,
        firstName: "Reece",
        lastName: "Mason",
        displayName: "Reece",
        email: "reece@sandman.example",
        payrollReference: "SDM-EMP-007",
        status: StaffStatus.ACTIVE,
        employmentStartAt: new Date("2025-10-20T00:00:00.000Z"),
      },
    }),
  ]);

  const [
    sandmanMeetingEventsDepartment,
    sandmanBreakfastDepartment,
    sandmanRoomServiceDepartment,
    sandmanBarDepartment,
    sandmanRestaurantDepartment,
  ] = await Promise.all([
    prisma.department.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        name: "Meeting & Events",
        slug: "meeting-events",
        type: DepartmentType.MEETING_EVENTS,
        description: "Events, ballroom, and banqueting service teams.",
      },
    }),
    prisma.department.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        name: "Breakfast",
        slug: "breakfast-pilot",
        type: DepartmentType.BREAKFAST,
        description: "Breakfast floor and buffet service.",
      },
    }),
    prisma.department.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        name: "Room Service",
        slug: "room-service",
        type: DepartmentType.ROOM_SERVICE,
        description: "In-room dining and late service delivery team.",
      },
    }),
    prisma.department.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanSharkClub.id,
        name: "Bar",
        slug: "bar-pilot",
        type: DepartmentType.BAR,
        description: "Future stage rollout, disabled in pilot.",
      },
    }),
    prisma.department.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanSharkClub.id,
        name: "Restaurant",
        slug: "restaurant-pilot",
        type: DepartmentType.RESTAURANT,
        description: "Future stage rollout, disabled in pilot.",
      },
    }),
  ]);

  await prisma.departmentStaffAssignment.createMany({
    data: [
      {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        departmentId: sandmanMeetingEventsDepartment.id,
        staffMemberId: katherine.id,
        isPrimary: true,
      },
      {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        departmentId: sandmanMeetingEventsDepartment.id,
        staffMemberId: peter.id,
        isPrimary: true,
      },
      {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        departmentId: sandmanBreakfastDepartment.id,
        staffMemberId: olivia.id,
        isPrimary: true,
      },
      {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        departmentId: sandmanBreakfastDepartment.id,
        staffMemberId: daniel.id,
        isPrimary: true,
      },
      {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        departmentId: sandmanRoomServiceDepartment.id,
        staffMemberId: morgan.id,
        isPrimary: true,
      },
      {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        departmentId: sandmanRoomServiceDepartment.id,
        staffMemberId: leah.id,
        isPrimary: true,
      },
      {
        customerId: sandmanHospitality.id,
        venueId: sandmanSharkClub.id,
        departmentId: sandmanBarDepartment.id,
        staffMemberId: reece.id,
        isPrimary: true,
      },
    ],
  });

  await prisma.customerDepartmentTippingSetting.createMany({
    data: [
      {
        customerId: sandmanHospitality.id,
        departmentType: DepartmentType.MEETING_EVENTS,
        qrTippingEnabled: true,
        teamTippingEnabled: true,
        individualTippingEnabled: false,
        shiftSelectorEnabled: false,
      },
      {
        customerId: sandmanHospitality.id,
        departmentType: DepartmentType.BREAKFAST,
        qrTippingEnabled: true,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
        shiftSelectorEnabled: true,
      },
      {
        customerId: sandmanHospitality.id,
        departmentType: DepartmentType.ROOM_SERVICE,
        qrTippingEnabled: true,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
        shiftSelectorEnabled: false,
      },
      {
        customerId: sandmanHospitality.id,
        departmentType: DepartmentType.BAR,
        qrTippingEnabled: false,
        teamTippingEnabled: true,
        individualTippingEnabled: false,
        shiftSelectorEnabled: false,
      },
      {
        customerId: sandmanHospitality.id,
        departmentType: DepartmentType.RESTAURANT,
        qrTippingEnabled: false,
        teamTippingEnabled: true,
        individualTippingEnabled: false,
        shiftSelectorEnabled: false,
      },
    ],
  });

  const [sandmanMePool, sandmanBreakfastPool, sandmanRoomServicePool] = await Promise.all([
    prisma.pool.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        name: "M&E Team Pool",
        slug: "me-team-pool",
        description: "Shared team pool for meeting and events service.",
        status: PoolStatus.ACTIVE,
      },
    }),
    prisma.pool.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        name: "Breakfast Team Pool",
        slug: "breakfast-team-pool",
        description: "Shared breakfast pool for guest-facing service staff.",
        status: PoolStatus.ACTIVE,
      },
    }),
    prisma.pool.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        name: "Room Service Team Pool",
        slug: "room-service-team-pool",
        description: "Shared room service pool for deliveries and tray collection.",
        status: PoolStatus.ACTIVE,
      },
    }),
  ]);

  await prisma.poolMember.createMany({
    data: [
      {
        poolId: sandmanMePool.id,
        staffMemberId: katherine.id,
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        poolId: sandmanMePool.id,
        staffMemberId: peter.id,
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        poolId: sandmanBreakfastPool.id,
        staffMemberId: olivia.id,
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        poolId: sandmanBreakfastPool.id,
        staffMemberId: daniel.id,
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        poolId: sandmanRoomServicePool.id,
        staffMemberId: morgan.id,
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        poolId: sandmanRoomServicePool.id,
        staffMemberId: leah.id,
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
  });

  const [sandmanBallroomServiceArea, sandmanBreakfastServiceArea, sandmanRoomServiceArea] =
    await Promise.all([
      prisma.serviceArea.create({
        data: {
          customerId: sandmanHospitality.id,
          venueId: sandmanHotel.id,
          departmentId: sandmanMeetingEventsDepartment.id,
          name: "Ballroom Event Sign",
          slug: "sandman-ballroom-events",
          description: "Event foyer QR sign for ballroom and banqueting tips.",
          tippingMode: TippingMode.TEAM_ONLY,
          displayMode: DisplayMode.EVENT_SIGN,
          noActiveShiftBehavior: NoActiveShiftBehavior.FALLBACK_TO_TEAM,
          teamTippingEnabled: true,
          individualTippingEnabled: false,
        },
      }),
      prisma.serviceArea.create({
        data: {
          customerId: sandmanHospitality.id,
          venueId: sandmanHotel.id,
          departmentId: sandmanBreakfastDepartment.id,
          name: "Breakfast Table Card",
          slug: "sandman-breakfast-service",
          description: "Table-side breakfast QR card for team or active shift staff selection.",
          tippingMode: TippingMode.SHIFT_SELECTOR,
          displayMode: DisplayMode.TABLE_CARD,
          noActiveShiftBehavior: NoActiveShiftBehavior.FALLBACK_TO_TEAM,
          teamTippingEnabled: true,
          individualTippingEnabled: true,
        },
      }),
      prisma.serviceArea.create({
        data: {
          customerId: sandmanHospitality.id,
          venueId: sandmanHotel.id,
          departmentId: sandmanRoomServiceDepartment.id,
          name: "Room Service Tent Card",
          slug: "sandman-room-service-team",
          description: "In-room tent card for room service tipping with optional staff selection.",
          tippingMode: TippingMode.TEAM_OR_INDIVIDUAL,
          displayMode: DisplayMode.OTHER,
          noActiveShiftBehavior: NoActiveShiftBehavior.FALLBACK_TO_TEAM,
          teamTippingEnabled: true,
          individualTippingEnabled: true,
        },
      }),
    ]);

  await prisma.qrAsset.createMany({
    data: [
      {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        departmentId: sandmanMeetingEventsDepartment.id,
        serviceAreaId: sandmanBallroomServiceArea.id,
        slug: "sandman-ballroom-event-sign",
        destinationType: "SERVICE_AREA",
        label: "Ballroom foyer QR",
        printName: "Ballroom Event Sign",
        displayMode: DisplayMode.EVENT_SIGN,
        previewConfig: {
          size: "A5",
          zone: "Ballroom foyer",
          message: "Tip the M&E Team",
        },
      },
      {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        departmentId: sandmanBreakfastDepartment.id,
        serviceAreaId: sandmanBreakfastServiceArea.id,
        slug: "sandman-breakfast-table-card",
        destinationType: "SERVICE_AREA",
        label: "Breakfast table QR",
        printName: "Breakfast Table Card",
        displayMode: DisplayMode.TABLE_CARD,
        previewConfig: {
          size: "Table card",
          zone: "Breakfast dining room",
          message: "Tip the Breakfast Team",
        },
      },
      {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        departmentId: sandmanRoomServiceDepartment.id,
        serviceAreaId: sandmanRoomServiceArea.id,
        slug: "sandman-room-service-tent-card",
        destinationType: "SERVICE_AREA",
        label: "Room service bedside tent card",
        printName: "Room Service Tent Card",
        displayMode: DisplayMode.OTHER,
        previewConfig: {
          size: "Bedside tent card",
          zone: "Guest rooms",
          message: "Tip today's Room Service Team",
        },
      },
    ],
  });

  const pilotNow = new Date();
  const hoursFromNow = (hours: number) => new Date(pilotNow.getTime() + hours * 60 * 60 * 1000);

  const [sandmanEventsShift, sandmanBreakfastShift, sandmanRoomServiceShift] = await Promise.all([
    prisma.shift.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        departmentId: sandmanMeetingEventsDepartment.id,
        name: "Ballroom Event Service",
        timezone: "Europe/London",
        startsAt: hoursFromNow(-1),
        endsAt: hoursFromNow(5),
        status: ShiftStatus.ACTIVE,
      },
    }),
    prisma.shift.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        departmentId: sandmanBreakfastDepartment.id,
        name: "Breakfast Service Pilot Shift",
        timezone: "Europe/London",
        startsAt: hoursFromNow(-2),
        endsAt: hoursFromNow(2),
        status: ShiftStatus.ACTIVE,
      },
    }),
    prisma.shift.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        departmentId: sandmanRoomServiceDepartment.id,
        name: "Room Service Active Shift",
        timezone: "Europe/London",
        startsAt: hoursFromNow(-1),
        endsAt: hoursFromNow(6),
        status: ShiftStatus.ACTIVE,
      },
    }),
  ]);

  await prisma.shiftStaffAssignment.createMany({
    data: [
      {
        shiftId: sandmanEventsShift.id,
        staffMemberId: katherine.id,
        role: "Events supervisor",
        eligibleForTips: true,
      },
      {
        shiftId: sandmanEventsShift.id,
        staffMemberId: peter.id,
        role: "Banqueting captain",
        eligibleForTips: true,
      },
      {
        shiftId: sandmanBreakfastShift.id,
        staffMemberId: olivia.id,
        role: "Breakfast host",
        eligibleForTips: true,
      },
      {
        shiftId: sandmanBreakfastShift.id,
        staffMemberId: daniel.id,
        role: "Buffet attendant",
        eligibleForTips: true,
      },
      {
        shiftId: sandmanRoomServiceShift.id,
        staffMemberId: morgan.id,
        role: "Room service captain",
        eligibleForTips: true,
      },
      {
        shiftId: sandmanRoomServiceShift.id,
        staffMemberId: leah.id,
        role: "In-room dining runner",
        eligibleForTips: true,
      },
    ],
  });

  await prisma.$transaction([
    prisma.allocationRule.create({
      data: {
        venueId: sandmanHotel.id,
        departmentId: sandmanMeetingEventsDepartment.id,
        serviceAreaId: sandmanBallroomServiceArea.id,
        scope: "SERVICE_AREA",
        selectionType: "TEAM",
        name: "Ballroom event team split",
        description: "Routes ballroom event tips to the M&E team pool.",
        priority: 200,
        isActive: true,
        effectiveFrom: hoursFromNow(-12),
        lines: {
          create: [
            {
              recipientType: AllocationRecipientType.POOL,
              poolId: sandmanMePool.id,
              percentageBps: 10000,
              sortOrder: 1,
            },
          ],
        },
      },
    }),
    prisma.allocationRule.create({
      data: {
        venueId: sandmanHotel.id,
        departmentId: sandmanBreakfastDepartment.id,
        serviceAreaId: sandmanBreakfastServiceArea.id,
        scope: "SERVICE_AREA",
        selectionType: "TEAM",
        name: "Breakfast team split",
        description: "Routes breakfast team tips to the breakfast pool.",
        priority: 200,
        isActive: true,
        effectiveFrom: hoursFromNow(-12),
        lines: {
          create: [
            {
              recipientType: AllocationRecipientType.POOL,
              poolId: sandmanBreakfastPool.id,
              percentageBps: 10000,
              sortOrder: 1,
            },
          ],
        },
      },
    }),
    prisma.allocationRule.create({
      data: {
        venueId: sandmanHotel.id,
        departmentId: sandmanBreakfastDepartment.id,
        serviceAreaId: sandmanBreakfastServiceArea.id,
        scope: "SERVICE_AREA",
        selectionType: "INDIVIDUAL",
        name: "Breakfast individual plus team share",
        description: "Primary share to selected breakfast staff member with a contribution to the team pool.",
        priority: 220,
        isActive: true,
        effectiveFrom: hoursFromNow(-12),
        lines: {
          create: [
            {
              recipientType: AllocationRecipientType.SELECTED_STAFF,
              percentageBps: 8500,
              sortOrder: 1,
            },
            {
              recipientType: AllocationRecipientType.POOL,
              poolId: sandmanBreakfastPool.id,
              percentageBps: 1500,
              sortOrder: 2,
            },
          ],
        },
      },
    }),
    prisma.allocationRule.create({
      data: {
        venueId: sandmanHotel.id,
        departmentId: sandmanRoomServiceDepartment.id,
        serviceAreaId: sandmanRoomServiceArea.id,
        scope: "SERVICE_AREA",
        selectionType: "TEAM",
        name: "Room service team split",
        description: "Routes room service team tips to the room service pool.",
        priority: 200,
        isActive: true,
        effectiveFrom: hoursFromNow(-12),
        lines: {
          create: [
            {
              recipientType: AllocationRecipientType.POOL,
              poolId: sandmanRoomServicePool.id,
              percentageBps: 10000,
              sortOrder: 1,
            },
          ],
        },
      },
    }),
    prisma.allocationRule.create({
      data: {
        venueId: sandmanHotel.id,
        departmentId: sandmanRoomServiceDepartment.id,
        serviceAreaId: sandmanRoomServiceArea.id,
        scope: "SERVICE_AREA",
        selectionType: "INDIVIDUAL",
        name: "Room service individual plus team share",
        description: "Primary share to selected room service staff member with a smaller contribution to the team pool.",
        priority: 220,
        isActive: true,
        effectiveFrom: hoursFromNow(-12),
        lines: {
          create: [
            {
              recipientType: AllocationRecipientType.SELECTED_STAFF,
              percentageBps: 8000,
              sortOrder: 1,
            },
            {
              recipientType: AllocationRecipientType.POOL,
              poolId: sandmanRoomServicePool.id,
              percentageBps: 2000,
              sortOrder: 2,
            },
          ],
        },
      },
    }),
  ]);

  const sandmanTransactions = [
    {
      qrCodeSlug: "sandman-ballroom-event-sign",
      destinationServiceAreaId: sandmanBallroomServiceArea.id,
      destinationType: QrDestinationType.SERVICE_AREA,
      destinationEmployeeId: null,
      destinationPoolId: sandmanMePool.id,
      guestSelectionType: "TEAM" as const,
      grossAmount: 120,
      occurredAt: hoursFromNow(-3),
      rating: 5,
      allocations: [
        { employeeId: katherine.id, poolId: sandmanMePool.id, percentage: 0.5 },
        { employeeId: peter.id, poolId: sandmanMePool.id, percentage: 0.5 },
      ],
    },
    {
      qrCodeSlug: "sandman-breakfast-table-card",
      destinationServiceAreaId: sandmanBreakfastServiceArea.id,
      destinationType: QrDestinationType.SERVICE_AREA,
      destinationEmployeeId: olivia.id,
      destinationPoolId: sandmanBreakfastPool.id,
      guestSelectionType: "INDIVIDUAL" as const,
      grossAmount: 18,
      occurredAt: hoursFromNow(-2),
      rating: 5,
      allocations: [
        { employeeId: olivia.id, poolId: null, percentage: 0.85 },
        { employeeId: daniel.id, poolId: sandmanBreakfastPool.id, percentage: 0.15 },
      ],
    },
    {
      qrCodeSlug: "sandman-room-service-tent-card",
      destinationServiceAreaId: sandmanRoomServiceArea.id,
      destinationType: QrDestinationType.SERVICE_AREA,
      destinationEmployeeId: morgan.id,
      destinationPoolId: sandmanRoomServicePool.id,
      guestSelectionType: "INDIVIDUAL" as const,
      grossAmount: 24,
      occurredAt: hoursFromNow(-1),
      rating: 4,
      allocations: [
        { employeeId: morgan.id, poolId: null, percentage: 0.8 },
        { employeeId: leah.id, poolId: sandmanRoomServicePool.id, percentage: 0.2 },
      ],
    },
  ];

  for (const transaction of sandmanTransactions) {
    const grossAmount = asMoney(transaction.grossAmount);
    const tipitFeeAmount = splitAmount(grossAmount, 0.0475);
    const netAmount = asMoney(grossAmount - tipitFeeAmount);

    const tipTransaction = await prisma.tipTransaction.create({
      data: {
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        payrollPeriodId: sandmanCurrentPeriod.id,
        qrCodeSlug: transaction.qrCodeSlug,
        destinationType: transaction.destinationType,
        destinationEmployeeId: transaction.destinationEmployeeId,
        destinationPoolId: transaction.destinationPoolId,
        destinationVenueId: sandmanHotel.id,
        destinationServiceAreaId: transaction.destinationServiceAreaId,
        guestSelectionType: transaction.guestSelectionType,
        currency: sandmanHospitality.currency,
        grossAmount,
        tipitFeeAmount,
        netAmount,
        status: TipTransactionStatus.SUCCEEDED,
        rating: transaction.rating,
        ratedAt: transaction.occurredAt,
        occurredAt: transaction.occurredAt,
      },
    });

    await prisma.allocationResult.createMany({
      data: transaction.allocations.map((allocation) => ({
        customerId: sandmanHospitality.id,
        venueId: sandmanHotel.id,
        payrollPeriodId: sandmanCurrentPeriod.id,
        tipTransactionId: tipTransaction.id,
        employeeId: allocation.employeeId,
        poolId: allocation.poolId,
        grossAmount: asMoney(grossAmount * allocation.percentage),
        netAmount: asMoney(netAmount * allocation.percentage),
      })),
    });
  }

  await prisma.auditLog.createMany({
    data: [
      {
        userId: sandmanAdminUser.id,
        customerId: sandmanHospitality.id,
        customerUserId: sandmanCustomerAdmin.id,
        entityType: "Customer",
        entityId: sandmanHospitality.id,
        action: "pilot-package.created",
        summary: "Seeded staged pilot rollout for Sandman Hospitality Group.",
        metadata: {
          enabledDepartments: ["MEETING_EVENTS", "BREAKFAST", "ROOM_SERVICE"],
          disabledDepartments: ["BAR", "RESTAURANT"],
        },
      },
      {
        userId: sandmanManagerUser.id,
        customerId: sandmanHospitality.id,
        customerUserId: sandmanCustomerManager.id,
        venueId: sandmanHotel.id,
        entityType: "Shift",
        entityId: sandmanBreakfastShift.id,
        action: "shift.activated",
        summary: "Activated breakfast pilot shift for public individual selection.",
      },
      {
        userId: sandmanViewerUser.id,
        customerId: sandmanHospitality.id,
        customerUserId: sandmanCustomerViewer.id,
        entityType: "QrAsset",
        entityId: sandmanBreakfastServiceArea.id,
        action: "qr.previewed",
        summary: "Viewed breakfast QR rollout configuration.",
      },
    ],
  });

  console.log("Seeded roles, customers, users, venues, staff, pools, payroll periods, transactions, allocation results, and audit logs.");
  console.log(`Created ${sharkRule.lines.length + emberRule.lines.length} allocation rule lines.`);
  console.log(`Customers: ${sharkClub.name}, ${emberDining.name}, ${sandmanHospitality.name}`);
  console.log(`Inactive venue seeded for admin filtering: ${sharkManchester.name}`);
  console.log("Pilot credentials: pilot.admin@sandman.example / Password123!, pilot.manager@sandman.example / Password123!, pilot.viewer@sandman.example / Password123!");
  console.log("Pilot URLs: /tip/sandman-ballroom-event-sign, /tip/sandman-breakfast-table-card, /tip/sandman-room-service-tent-card");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
*/
