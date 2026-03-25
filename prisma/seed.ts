import {
  AllocationRecipientType,
  QrDestinationType,
  CustomerStatus,
  PayrollFrequency,
  PoolStatus,
  PrismaClient,
  StaffStatus,
  SettlementFrequency,
  TipTransactionStatus,
  UserRole,
  VenueType,
  VenueStatus,
} from "@prisma/client";
import { hashPassword } from "../src/server/shared/auth/password";

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
  const demoPasswordHash = await hashPassword("Password123!");

  await prisma.auditLog.deleteMany();
  await prisma.allocationResult.deleteMany();
  await prisma.tipTransaction.deleteMany();
  await prisma.payrollPeriod.deleteMany();
  await prisma.allocationRuleLine.deleteMany();
  await prisma.allocationRule.deleteMany();
  await prisma.poolMember.deleteMany();
  await prisma.pool.deleteMany();
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

  console.log("Seeded roles, customers, users, venues, staff, pools, payroll periods, transactions, allocation results, and audit logs.");
  console.log(`Created ${sharkRule.lines.length + emberRule.lines.length} allocation rule lines.`);
  console.log(`Customers: ${sharkClub.name}, ${emberDining.name}`);
  console.log(`Inactive venue seeded for admin filtering: ${sharkManchester.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
