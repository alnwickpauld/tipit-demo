import {
  AllocationRecipientType,
  CustomerStatus,
  DepartmentType,
  DisplayMode,
  IntegrationProvider,
  PayrollFrequency,
  PoolStatus,
  PrismaClient,
  QrDestinationType,
  StaffStatus,
  SettlementFrequency,
  ShiftStatus,
  TipSelectionType,
  TipTransactionStatus,
  UserRole,
  VenueType,
  VenueStatus,
} from "@prisma/client";

import { hashPassword } from "../src/server/shared/auth/password";

type SeedStaff = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  status: StaffStatus;
  venueId: string;
  departmentId: string;
  staffCode: string;
  externalPayrollRef: string;
  hoursWorked: number;
};

type SuccessfulSeedTransaction = {
  venueId: string;
  serviceAreaId: string;
  qrCodeSlug: string;
  destinationPoolId: string | null;
  destinationEmployeeId: string | null;
  destinationType: QrDestinationType;
  guestSelectionType: TipSelectionType;
  grossAmount: number;
  occurredAt: Date;
  rating: number;
  payrollPeriodId: string;
  poolMembers: SeedStaff[] | null;
  selectedEmployee: SeedStaff | null;
};

function asMoney(value: number) {
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

function startOfCurrentFortnight(date: Date) {
  const monday = startOfUtcDay(date);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday;
}

function splitWeighted(total: number, weightedMembers: Array<{ employeeId: string; weight: number }>) {
  const totalCents = Math.round(total * 100);
  const totalWeight = weightedMembers.reduce((sum, member) => sum + member.weight, 0);
  let remaining = totalCents;

  return weightedMembers.map((member, index) => {
    const cents =
      index === weightedMembers.length - 1
        ? remaining
        : Math.round((totalCents * member.weight) / totalWeight);
    remaining -= cents;
    return {
      employeeId: member.employeeId,
      amount: cents / 100,
    };
  });
}

async function seedRoles(prisma: PrismaClient) {
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

export async function seedSandmanPilotDemo(prisma: PrismaClient) {
  const demoPasswordHash = await hashPassword("Password123!");
  const now = new Date();
  const currentPeriodStart = startOfCurrentFortnight(now);
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

  await seedRoles(prisma);

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

  const sandman = await prisma.customer.create({
    data: {
      name: "Sandman Hotel Group UK",
      slug: "sandman-hotel-group-uk",
      legalName: "Sandman Hotel Group UK Ltd",
      contactEmail: "finance@sandman.example",
      contactPhone: "+44 20 5550 1188",
      status: CustomerStatus.ACTIVE,
      tipitFeeBps: 475,
      currency: "GBP",
      timezone: "Europe/London",
    },
  });

  const [sandmanAdminUser, sandmanManagerUser, sandmanViewerUser] = await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@sandman.example",
        passwordHash: demoPasswordHash,
        firstName: "Sophie",
        lastName: "Murray",
      },
    }),
    prisma.user.create({
      data: {
        email: "manager@sandman.example",
        passwordHash: demoPasswordHash,
        firstName: "Connor",
        lastName: "Lane",
      },
    }),
    prisma.user.create({
      data: {
        email: "viewer@sandman.example",
        passwordHash: demoPasswordHash,
        firstName: "Holly",
        lastName: "Evans",
      },
    }),
  ]);

  const [sandmanCustomerAdmin, sandmanCustomerManager, sandmanCustomerViewer] = await Promise.all([
    prisma.customerUser.create({
      data: {
        customerId: sandman.id,
        userId: sandmanAdminUser.id,
        roleId: customerAdminRole.id,
      },
    }),
    prisma.customerUser.create({
      data: {
        customerId: sandman.id,
        userId: sandmanManagerUser.id,
        roleId: customerManagerRole.id,
      },
    }),
    prisma.customerUser.create({
      data: {
        customerId: sandman.id,
        userId: sandmanViewerUser.id,
        roleId: customerViewerRole.id,
      },
    }),
  ]);

  await prisma.payrollConfig.create({
    data: {
      customerId: sandman.id,
      frequency: PayrollFrequency.FORTNIGHTLY,
      settlementFrequency: SettlementFrequency.FORTNIGHTLY,
      payPeriodAnchor: currentPeriodStart,
      settlementDay: 3,
      exportEmail: "payroll@sandman.example",
      notes: "Pilot rollout for Sandman Signature Newcastle and Portmarnock Resort.",
    },
  });

  const [previousPeriod, currentPeriod] = await Promise.all([
    prisma.payrollPeriod.create({
      data: {
        customerId: sandman.id,
        frequency: PayrollFrequency.FORTNIGHTLY,
        label: "Previous Fortnight",
        startsAt: previousPeriodStart,
        endsAt: previousPeriodEnd,
      },
    }),
    prisma.payrollPeriod.create({
      data: {
        customerId: sandman.id,
        frequency: PayrollFrequency.FORTNIGHTLY,
        label: "Current Fortnight",
        startsAt: currentPeriodStart,
        endsAt: currentPeriodEnd,
      },
    }),
  ]);

  const [newcastle, portmarnock] = await Promise.all([
    prisma.venue.create({
      data: {
        customerId: sandman.id,
        name: "Sandman Signature Newcastle",
        slug: "sandman-signature-newcastle",
        code: "SSN-001",
        type: VenueType.OTHER,
        description: "City-centre hotel pilot for breakfast and room service tipping.",
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
    }),
    prisma.venue.create({
      data: {
        customerId: sandman.id,
        name: "Portmarnock Resort",
        slug: "portmarnock-resort",
        code: "PMR-001",
        type: VenueType.EVENT_SPACE,
        description: "Meetings, weddings, conferences, and private dining events venue.",
        address: "Strand Road, Portmarnock, Co. Dublin, D13 V2X7",
        timezone: "Europe/Dublin",
        status: VenueStatus.ACTIVE,
        addressLine1: "Strand Road",
        city: "Portmarnock",
        postcode: "D13 V2X7",
        country: "IE",
        brandBackgroundColor: "#857868",
        brandTextColor: "#FFF8F1",
        brandButtonColor: "#B39D88",
        brandButtonTextColor: "#FFFFFF",
        brandLogoImageUrl: "/sandman-signature-hotel-586x390.jpg",
      },
    }),
  ]);

  const [breakfastDepartment, roomServiceDepartment, barDepartment, restaurantDepartment, eventsDepartment] =
    await Promise.all([
      prisma.department.create({
        data: {
          customerId: sandman.id,
          venueId: newcastle.id,
          name: "Breakfast",
          slug: "breakfast",
          type: DepartmentType.BREAKFAST,
          description: "Breakfast restaurant and host team.",
          isActive: true,
        },
      }),
      prisma.department.create({
        data: {
          customerId: sandman.id,
          venueId: newcastle.id,
          name: "Room Service",
          slug: "room-service",
          type: DepartmentType.ROOM_SERVICE,
          description: "In-room dining and tray collection service.",
          isActive: true,
        },
      }),
      prisma.department.create({
        data: {
          customerId: sandman.id,
          venueId: newcastle.id,
          name: "Bar",
          slug: "bar",
          type: DepartmentType.BAR,
          description: "Disabled for pilot rollout.",
          isActive: false,
        },
      }),
      prisma.department.create({
        data: {
          customerId: sandman.id,
          venueId: newcastle.id,
          name: "Restaurant",
          slug: "restaurant",
          type: DepartmentType.RESTAURANT,
          description: "Disabled for pilot rollout.",
          isActive: false,
        },
      }),
      prisma.department.create({
        data: {
          customerId: sandman.id,
          venueId: portmarnock.id,
          name: "Meeting & Events",
          slug: "meeting-events",
          type: DepartmentType.MEETING_EVENTS,
          description: "Ballroom, conference, and private dining service team.",
          isActive: true,
        },
      }),
    ]);

  await prisma.customerDepartmentTippingSetting.createMany({
    data: [
      {
        customerId: sandman.id,
        departmentType: DepartmentType.BREAKFAST,
        qrTippingEnabled: true,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
        shiftSelectorEnabled: true,
      },
      {
        customerId: sandman.id,
        departmentType: DepartmentType.ROOM_SERVICE,
        qrTippingEnabled: true,
        teamTippingEnabled: true,
        individualTippingEnabled: false,
        shiftSelectorEnabled: false,
      },
      {
        customerId: sandman.id,
        departmentType: DepartmentType.MEETING_EVENTS,
        qrTippingEnabled: true,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
        shiftSelectorEnabled: true,
      },
      {
        customerId: sandman.id,
        departmentType: DepartmentType.BAR,
        qrTippingEnabled: false,
        teamTippingEnabled: false,
        individualTippingEnabled: false,
        shiftSelectorEnabled: false,
      },
      {
        customerId: sandman.id,
        departmentType: DepartmentType.RESTAURANT,
        qrTippingEnabled: false,
        teamTippingEnabled: false,
        individualTippingEnabled: false,
        shiftSelectorEnabled: false,
      },
    ],
  });

  const breakfastStaffDefinitions = [
    ["Olivia", "Chen", "Olivia", StaffStatus.ACTIVE, "SSN-BRK-001", "BRK-1001", 38],
    ["Daniel", "Murphy", "Daniel", StaffStatus.ACTIVE, "SSN-BRK-002", "BRK-1002", 34],
    ["Harper", "Singh", "Harper", StaffStatus.ACTIVE, "SSN-BRK-003", "BRK-1003", 29],
    ["Eva", "Rossi", "Eva", StaffStatus.ACTIVE, "SSN-BRK-004", "BRK-1004", 18],
    ["Sean", "Kelly", "Sean", StaffStatus.ACTIVE, "SSN-BRK-005", "BRK-1005", 24],
    ["Chloe", "Martin", "Chloe", StaffStatus.INACTIVE, "SSN-BRK-006", "BRK-1006", 0],
  ] as const;
  const roomServiceStaffDefinitions = [
    ["Morgan", "Shaw", "Morgan", StaffStatus.ACTIVE, "SSN-RS-001", "RS-2001", 32],
    ["Leah", "Cross", "Leah", StaffStatus.ACTIVE, "SSN-RS-002", "RS-2002", 27],
    ["Conor", "Walsh", "Conor", StaffStatus.ACTIVE, "SSN-RS-003", "RS-2003", 18],
    ["Isla", "Boyd", "Isla", StaffStatus.INACTIVE, "SSN-RS-004", "RS-2004", 0],
  ] as const;
  const eventsStaffDefinitions = [
    ["Katherine", "Bell", "Katherine", StaffStatus.ACTIVE, "PMR-ME-001", "ME-3001", 44],
    ["Peter", "Dunn", "Peter", StaffStatus.ACTIVE, "PMR-ME-002", "ME-3002", 39],
    ["Amelia", "Hayes", "Amelia", StaffStatus.ACTIVE, "PMR-ME-003", "ME-3003", 36],
    ["Liam", "O'Connor", "Liam", StaffStatus.ACTIVE, "PMR-ME-004", "ME-3004", 34],
    ["Sofia", "Petrova", "Sofia", StaffStatus.ACTIVE, "PMR-ME-005", "ME-3005", 31],
    ["Ben", "Carter", "Ben", StaffStatus.ACTIVE, "PMR-ME-006", "ME-3006", 28],
    ["Grace", "Nolan", "Grace", StaffStatus.ACTIVE, "PMR-ME-007", "ME-3007", 24],
    ["Jack", "Murray", "Jack", StaffStatus.ACTIVE, "PMR-ME-008", "ME-3008", 21],
    ["Niamh", "Doyle", "Niamh", StaffStatus.ACTIVE, "PMR-ME-009", "ME-3009", 18],
    ["Owen", "Quinn", "Owen", StaffStatus.ACTIVE, "PMR-ME-010", "ME-3010", 16],
    ["Ruby", "Flynn", "Ruby", StaffStatus.INACTIVE, "PMR-ME-011", "ME-3011", 0],
    ["Ethan", "Clarke", "Ethan", StaffStatus.INACTIVE, "PMR-ME-012", "ME-3012", 0],
  ] as const;

  const breakfastStaff: SeedStaff[] = [];
  for (const [firstName, lastName, displayName, status, staffCode, externalPayrollRef, hoursWorked] of breakfastStaffDefinitions) {
    const staffMember = await prisma.staffMember.create({
      data: {
        customerId: sandman.id,
        venueId: newcastle.id,
        firstName,
        lastName,
        displayName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}@sandman.example`,
        staffCode,
        externalPayrollRef,
        payrollReference: externalPayrollRef,
        status,
        employmentStartAt: addDays(currentPeriodStart, -150),
      },
    });

    breakfastStaff.push({
      id: staffMember.id,
      firstName,
      lastName,
      displayName,
      status,
      venueId: newcastle.id,
      departmentId: breakfastDepartment.id,
      staffCode,
      externalPayrollRef,
      hoursWorked,
    });
  }

  const roomServiceStaff: SeedStaff[] = [];
  for (const [firstName, lastName, displayName, status, staffCode, externalPayrollRef, hoursWorked] of roomServiceStaffDefinitions) {
    const staffMember = await prisma.staffMember.create({
      data: {
        customerId: sandman.id,
        venueId: newcastle.id,
        firstName,
        lastName,
        displayName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}@sandman.example`,
        staffCode,
        externalPayrollRef,
        payrollReference: externalPayrollRef,
        status,
        employmentStartAt: addDays(currentPeriodStart, -130),
      },
    });

    roomServiceStaff.push({
      id: staffMember.id,
      firstName,
      lastName,
      displayName,
      status,
      venueId: newcastle.id,
      departmentId: roomServiceDepartment.id,
      staffCode,
      externalPayrollRef,
      hoursWorked,
    });
  }

  const eventsStaff: SeedStaff[] = [];
  for (const [firstName, lastName, displayName, status, staffCode, externalPayrollRef, hoursWorked] of eventsStaffDefinitions) {
    const staffMember = await prisma.staffMember.create({
      data: {
        customerId: sandman.id,
        venueId: portmarnock.id,
        firstName,
        lastName,
        displayName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}@portmarnock.example`,
        staffCode,
        externalPayrollRef,
        payrollReference: externalPayrollRef,
        status,
        employmentStartAt: addDays(currentPeriodStart, -200),
      },
    });

    eventsStaff.push({
      id: staffMember.id,
      firstName,
      lastName,
      displayName,
      status,
      venueId: portmarnock.id,
      departmentId: eventsDepartment.id,
      staffCode,
      externalPayrollRef,
      hoursWorked,
    });
  }

  await prisma.departmentStaffAssignment.createMany({
    data: [
      ...breakfastStaff.map((staff) => ({
        customerId: sandman.id,
        venueId: newcastle.id,
        departmentId: breakfastDepartment.id,
        staffMemberId: staff.id,
        isPrimary: true,
        isActive: staff.status === StaffStatus.ACTIVE,
      })),
      ...roomServiceStaff.map((staff) => ({
        customerId: sandman.id,
        venueId: newcastle.id,
        departmentId: roomServiceDepartment.id,
        staffMemberId: staff.id,
        isPrimary: true,
        isActive: staff.status === StaffStatus.ACTIVE,
      })),
      ...eventsStaff.map((staff) => ({
        customerId: sandman.id,
        venueId: portmarnock.id,
        departmentId: eventsDepartment.id,
        staffMemberId: staff.id,
        isPrimary: true,
        isActive: staff.status === StaffStatus.ACTIVE,
      })),
    ],
  });

  const [breakfastTeamPool, roomServiceTeamPool, eventTeamPool, eventBarPool] = await Promise.all([
    prisma.pool.create({
      data: {
        customerId: sandman.id,
        venueId: newcastle.id,
        name: "Breakfast Team Pool",
        slug: "breakfast-team-pool",
        description: "Breakfast pooled distribution for team selections.",
        status: PoolStatus.ACTIVE,
      },
    }),
    prisma.pool.create({
      data: {
        customerId: sandman.id,
        venueId: newcastle.id,
        name: "Room Service Team Pool",
        slug: "room-service-team-pool",
        description: "Room service pooled distribution for team selections.",
        status: PoolStatus.ACTIVE,
      },
    }),
    prisma.pool.create({
      data: {
        customerId: sandman.id,
        venueId: portmarnock.id,
        name: "Event Team Pool",
        slug: "event-team-pool",
        description: "Core M&E event operations pool.",
        status: PoolStatus.ACTIVE,
      },
    }),
    prisma.pool.create({
      data: {
        customerId: sandman.id,
        venueId: portmarnock.id,
        name: "Event Bar Pool",
        slug: "event-bar-pool",
        description: "Dedicated event bar support pool for future rollout use.",
        status: PoolStatus.ACTIVE,
      },
    }),
  ]);

  await prisma.poolMember.createMany({
    data: [
      ...breakfastStaff
        .filter((staff) => staff.status === StaffStatus.ACTIVE)
        .map((staff) => ({
          poolId: breakfastTeamPool.id,
          staffMemberId: staff.id,
          joinedAt: addDays(currentPeriodStart, -60),
        })),
      ...roomServiceStaff
        .filter((staff) => staff.status === StaffStatus.ACTIVE)
        .map((staff) => ({
          poolId: roomServiceTeamPool.id,
          staffMemberId: staff.id,
          joinedAt: addDays(currentPeriodStart, -60),
        })),
      ...eventsStaff
        .filter((staff) => staff.status === StaffStatus.ACTIVE)
        .map((staff) => ({
          poolId: eventTeamPool.id,
          staffMemberId: staff.id,
          joinedAt: addDays(currentPeriodStart, -60),
        })),
      ...eventsStaff
        .filter((staff) => ["Ben", "Jack", "Niamh", "Owen"].includes(staff.firstName))
        .map((staff) => ({
          poolId: eventBarPool.id,
          staffMemberId: staff.id,
          joinedAt: addDays(currentPeriodStart, -45),
        })),
    ],
  });

  const [tableCardA, tableCardB, hostStand, trayCard, inRoomTentCard, ballroomEventSign, conferenceFoyerSign, privateDiningQr] =
    await Promise.all([
      prisma.serviceArea.create({
        data: {
          customerId: sandman.id,
          venueId: newcastle.id,
          departmentId: breakfastDepartment.id,
          name: "Table Card A",
          slug: "ssn-breakfast-table-card-a",
          description: "Breakfast dining room table card A.",
          tippingMode: "TEAM_OR_INDIVIDUAL",
          displayMode: DisplayMode.TABLE_CARD,
          teamTippingEnabled: true,
          individualTippingEnabled: true,
        },
      }),
      prisma.serviceArea.create({
        data: {
          customerId: sandman.id,
          venueId: newcastle.id,
          departmentId: breakfastDepartment.id,
          name: "Table Card B",
          slug: "ssn-breakfast-table-card-b",
          description: "Breakfast dining room table card B.",
          tippingMode: "TEAM_OR_INDIVIDUAL",
          displayMode: DisplayMode.TABLE_CARD,
          teamTippingEnabled: true,
          individualTippingEnabled: true,
        },
      }),
      prisma.serviceArea.create({
        data: {
          customerId: sandman.id,
          venueId: newcastle.id,
          departmentId: breakfastDepartment.id,
          name: "Host Stand",
          slug: "ssn-breakfast-host-stand",
          description: "Breakfast host podium QR.",
          tippingMode: "TEAM_OR_INDIVIDUAL",
          displayMode: DisplayMode.TABLE_CARD,
          teamTippingEnabled: true,
          individualTippingEnabled: true,
        },
      }),
      prisma.serviceArea.create({
        data: {
          customerId: sandman.id,
          venueId: newcastle.id,
          departmentId: roomServiceDepartment.id,
          name: "Tray Card",
          slug: "ssn-room-service-tray-card",
          description: "Room service tray QR for in-room dining.",
          tippingMode: "TEAM_ONLY",
          displayMode: DisplayMode.TABLE_CARD,
          teamTippingEnabled: true,
          individualTippingEnabled: false,
        },
      }),
      prisma.serviceArea.create({
        data: {
          customerId: sandman.id,
          venueId: newcastle.id,
          departmentId: roomServiceDepartment.id,
          name: "In-Room Tent Card",
          slug: "ssn-room-service-in-room-tent-card",
          description: "Guest bedside room service tent card.",
          tippingMode: "TEAM_ONLY",
          displayMode: DisplayMode.TABLE_CARD,
          teamTippingEnabled: true,
          individualTippingEnabled: false,
        },
      }),
      prisma.serviceArea.create({
        data: {
          customerId: sandman.id,
          venueId: portmarnock.id,
          departmentId: eventsDepartment.id,
          name: "Ballroom Event Sign",
          slug: "pmr-ballroom-event-sign",
          description: "Ballroom main entrance event QR sign.",
          tippingMode: "TEAM_OR_INDIVIDUAL",
          displayMode: DisplayMode.EVENT_SIGN,
          teamTippingEnabled: true,
          individualTippingEnabled: true,
        },
      }),
      prisma.serviceArea.create({
        data: {
          customerId: sandman.id,
          venueId: portmarnock.id,
          departmentId: eventsDepartment.id,
          name: "Conference Foyer Sign",
          slug: "pmr-conference-foyer-sign",
          description: "Conference foyer QR prompt for delegates.",
          tippingMode: "TEAM_OR_INDIVIDUAL",
          displayMode: DisplayMode.EVENT_SIGN,
          teamTippingEnabled: true,
          individualTippingEnabled: true,
        },
      }),
      prisma.serviceArea.create({
        data: {
          customerId: sandman.id,
          venueId: portmarnock.id,
          departmentId: eventsDepartment.id,
          name: "Private Dining QR",
          slug: "pmr-private-dining-qr",
          description: "Private dining room discreet QR insert.",
          tippingMode: "TEAM_OR_INDIVIDUAL",
          displayMode: DisplayMode.EVENT_SIGN,
          teamTippingEnabled: true,
          individualTippingEnabled: true,
        },
      }),
    ]);

  await prisma.qrAsset.createMany({
    data: [
      {
        customerId: sandman.id,
        venueId: newcastle.id,
        departmentId: breakfastDepartment.id,
        serviceAreaId: tableCardA.id,
        slug: "ssn-breakfast-table-card-a",
        destinationType: "SERVICE_AREA",
        label: "Breakfast Table Card A",
        printName: "Sandman Signature Newcastle Breakfast Table Card A",
        displayMode: DisplayMode.TABLE_CARD,
        previewConfig: { placement: "Table 1-14", format: "table-card" },
      },
      {
        customerId: sandman.id,
        venueId: newcastle.id,
        departmentId: breakfastDepartment.id,
        serviceAreaId: tableCardB.id,
        slug: "ssn-breakfast-table-card-b",
        destinationType: "SERVICE_AREA",
        label: "Breakfast Table Card B",
        printName: "Sandman Signature Newcastle Breakfast Table Card B",
        displayMode: DisplayMode.TABLE_CARD,
        previewConfig: { placement: "Table 15-28", format: "table-card" },
      },
      {
        customerId: sandman.id,
        venueId: newcastle.id,
        departmentId: breakfastDepartment.id,
        serviceAreaId: hostStand.id,
        slug: "ssn-breakfast-host-stand",
        destinationType: "SERVICE_AREA",
        label: "Breakfast Host Stand",
        printName: "Sandman Signature Newcastle Breakfast Host Stand",
        displayMode: DisplayMode.TABLE_CARD,
        previewConfig: { placement: "Host podium", format: "counter-card" },
      },
      {
        customerId: sandman.id,
        venueId: newcastle.id,
        departmentId: roomServiceDepartment.id,
        serviceAreaId: trayCard.id,
        slug: "ssn-room-service-tray-card",
        destinationType: "SERVICE_AREA",
        label: "Room Service Tray Card",
        printName: "Sandman Signature Newcastle Room Service Tray Card",
        displayMode: DisplayMode.TABLE_CARD,
        previewConfig: { placement: "Room service tray", format: "tray-card" },
      },
      {
        customerId: sandman.id,
        venueId: newcastle.id,
        departmentId: roomServiceDepartment.id,
        serviceAreaId: inRoomTentCard.id,
        slug: "ssn-room-service-in-room-tent-card",
        destinationType: "SERVICE_AREA",
        label: "Room Service In-Room Tent Card",
        printName: "Sandman Signature Newcastle In-Room Tent Card",
        displayMode: DisplayMode.TABLE_CARD,
        previewConfig: { placement: "Bedside table", format: "tent-card" },
      },
      {
        customerId: sandman.id,
        venueId: portmarnock.id,
        departmentId: eventsDepartment.id,
        serviceAreaId: ballroomEventSign.id,
        slug: "pmr-ballroom-event-sign",
        destinationType: "SERVICE_AREA",
        label: "Ballroom Event Sign",
        printName: "Portmarnock Resort Ballroom Event Sign",
        displayMode: DisplayMode.EVENT_SIGN,
        previewConfig: { placement: "Ballroom foyer", format: "event-sign" },
      },
      {
        customerId: sandman.id,
        venueId: portmarnock.id,
        departmentId: eventsDepartment.id,
        serviceAreaId: conferenceFoyerSign.id,
        slug: "pmr-conference-foyer-sign",
        destinationType: "SERVICE_AREA",
        label: "Conference Foyer Sign",
        printName: "Portmarnock Resort Conference Foyer Sign",
        displayMode: DisplayMode.EVENT_SIGN,
        previewConfig: { placement: "Conference foyer", format: "event-sign" },
      },
      {
        customerId: sandman.id,
        venueId: portmarnock.id,
        departmentId: eventsDepartment.id,
        serviceAreaId: privateDiningQr.id,
        slug: "pmr-private-dining-qr",
        destinationType: "SERVICE_AREA",
        label: "Private Dining QR",
        printName: "Portmarnock Resort Private Dining QR",
        displayMode: DisplayMode.EVENT_SIGN,
        previewConfig: { placement: "Private dining room", format: "bill-folder" },
      },
    ],
  });

  const breakfastActiveShift = await prisma.shift.create({
    data: {
      customerId: sandman.id,
      venueId: newcastle.id,
      departmentId: breakfastDepartment.id,
      name: "Breakfast Service Live Shift",
      timezone: "Europe/London",
      startsAt: addHours(now, -1.5),
      endsAt: addHours(now, 2.5),
      status: ShiftStatus.ACTIVE,
    },
  });

  const roomServiceActiveShift = await prisma.shift.create({
    data: {
      customerId: sandman.id,
      venueId: newcastle.id,
      departmentId: roomServiceDepartment.id,
      name: "Room Service Lunch Shift",
      timezone: "Europe/London",
      startsAt: addHours(now, -1),
      endsAt: addHours(now, 5),
      status: ShiftStatus.ACTIVE,
    },
  });

  const eventsActiveShift = await prisma.shift.create({
    data: {
      customerId: sandman.id,
      venueId: portmarnock.id,
      departmentId: eventsDepartment.id,
      name: "Conference & Events Shift",
      timezone: "Europe/Dublin",
      startsAt: addHours(now, -2),
      endsAt: addHours(now, 6),
      status: ShiftStatus.ACTIVE,
    },
  });

  const breakfastUpcomingShift = await prisma.shift.create({
    data: {
      customerId: sandman.id,
      venueId: newcastle.id,
      departmentId: breakfastDepartment.id,
      name: "Breakfast Tomorrow",
      timezone: "Europe/London",
      startsAt: addDays(addHours(startOfUtcDay(now), 6), 1),
      endsAt: addDays(addHours(startOfUtcDay(now), 11), 1),
      status: ShiftStatus.SCHEDULED,
    },
  });

  const roomServiceCompletedShift = await prisma.shift.create({
    data: {
      customerId: sandman.id,
      venueId: newcastle.id,
      departmentId: roomServiceDepartment.id,
      name: "Room Service Previous Evening",
      timezone: "Europe/London",
      startsAt: addDays(addHours(startOfUtcDay(now), 17), -1),
      endsAt: addDays(addHours(startOfUtcDay(now), 23), -1),
      status: ShiftStatus.COMPLETED,
    },
  });

  const eventsCancelledShift = await prisma.shift.create({
    data: {
      customerId: sandman.id,
      venueId: portmarnock.id,
      departmentId: eventsDepartment.id,
      name: "Private Dining Cancellation",
      timezone: "Europe/Dublin",
      startsAt: addDays(addHours(startOfUtcDay(now), 18), 1),
      endsAt: addDays(addHours(startOfUtcDay(now), 23), 1),
      status: ShiftStatus.CANCELLED,
    },
  });

  const breakfastByName = Object.fromEntries(breakfastStaff.map((staff) => [staff.firstName, staff]));
  const roomServiceByName = Object.fromEntries(roomServiceStaff.map((staff) => [staff.firstName, staff]));
  const eventsByName = Object.fromEntries(eventsStaff.map((staff) => [staff.firstName, staff]));

  await prisma.shiftStaffAssignment.createMany({
    data: [
      {
        shiftId: breakfastActiveShift.id,
        staffMemberId: breakfastByName.Olivia.id,
        role: "Breakfast Supervisor",
        eligibleForTips: true,
      },
      {
        shiftId: breakfastActiveShift.id,
        staffMemberId: breakfastByName.Daniel.id,
        role: "Server",
        eligibleForTips: true,
      },
      {
        shiftId: breakfastActiveShift.id,
        staffMemberId: breakfastByName.Harper.id,
        role: "Server",
        eligibleForTips: true,
      },
      {
        shiftId: breakfastActiveShift.id,
        staffMemberId: breakfastByName.Eva.id,
        role: "Host",
        eligibleForTips: true,
      },
      {
        shiftId: roomServiceActiveShift.id,
        staffMemberId: roomServiceByName.Morgan.id,
        role: "Room Service Supervisor",
        eligibleForTips: true,
      },
      {
        shiftId: roomServiceActiveShift.id,
        staffMemberId: roomServiceByName.Leah.id,
        role: "Room Service Attendant",
        eligibleForTips: true,
      },
      {
        shiftId: eventsActiveShift.id,
        staffMemberId: eventsByName.Katherine.id,
        role: "Event Supervisor",
        eligibleForTips: true,
      },
      {
        shiftId: eventsActiveShift.id,
        staffMemberId: eventsByName.Peter.id,
        role: "Banqueting Supervisor",
        eligibleForTips: true,
      },
      {
        shiftId: eventsActiveShift.id,
        staffMemberId: eventsByName.Amelia.id,
        role: "Banqueting Staff",
        eligibleForTips: true,
      },
      {
        shiftId: eventsActiveShift.id,
        staffMemberId: eventsByName.Liam.id,
        role: "Banqueting Staff",
        eligibleForTips: true,
      },
      {
        shiftId: eventsActiveShift.id,
        staffMemberId: eventsByName.Sofia.id,
        role: "Event Captain",
        eligibleForTips: true,
      },
      {
        shiftId: eventsActiveShift.id,
        staffMemberId: eventsByName.Ben.id,
        role: "Event Bar Lead",
        eligibleForTips: true,
      },
      {
        shiftId: eventsActiveShift.id,
        staffMemberId: eventsByName.Grace.id,
        role: "Banqueting Staff",
        eligibleForTips: true,
      },
      {
        shiftId: breakfastUpcomingShift.id,
        staffMemberId: breakfastByName.Sean.id,
        role: "Server",
        eligibleForTips: true,
      },
      {
        shiftId: roomServiceCompletedShift.id,
        staffMemberId: roomServiceByName.Conor.id,
        role: "Room Service Attendant",
        eligibleForTips: true,
      },
      {
        shiftId: eventsCancelledShift.id,
        staffMemberId: eventsByName.Jack.id,
        role: "Banqueting Staff",
        eligibleForTips: true,
      },
    ],
  });

  const activeBreakfastPoolMembers = breakfastStaff.filter((staff) => staff.status === StaffStatus.ACTIVE);
  const activeRoomServicePoolMembers = roomServiceStaff.filter((staff) => staff.status === StaffStatus.ACTIVE);
  const activeEventsPoolMembers = eventsStaff.filter((staff) => staff.status === StaffStatus.ACTIVE);

  const [breakfastTeamRule, breakfastIndividualRule, roomServiceTeamRule, eventsTeamRule, eventsIndividualRule, legacyRule] =
    await Promise.all([
      prisma.allocationRule.create({
        data: {
          venueId: newcastle.id,
          departmentId: breakfastDepartment.id,
          scope: "DEPARTMENT",
          selectionType: "TEAM",
          name: "Breakfast team pool distribution",
          description: "Breakfast team tips route fully into the Breakfast Team Pool.",
          priority: 200,
          isActive: true,
          effectiveFrom: currentPeriodStart,
          lines: {
            create: [
              {
                recipientType: AllocationRecipientType.POOL,
                poolId: breakfastTeamPool.id,
                percentageBps: 10000,
                sortOrder: 1,
              },
            ],
          },
        },
      }),
      prisma.allocationRule.create({
        data: {
          venueId: newcastle.id,
          departmentId: breakfastDepartment.id,
          scope: "DEPARTMENT",
          selectionType: "INDIVIDUAL",
          name: "Breakfast direct to selected team member",
          description: "Breakfast individual tips route fully to the selected employee.",
          priority: 220,
          isActive: true,
          effectiveFrom: currentPeriodStart,
          lines: {
            create: [
              {
                recipientType: AllocationRecipientType.SELECTED_STAFF,
                percentageBps: 10000,
                sortOrder: 1,
              },
            ],
          },
        },
      }),
      prisma.allocationRule.create({
        data: {
          venueId: newcastle.id,
          departmentId: roomServiceDepartment.id,
          scope: "DEPARTMENT",
          selectionType: "TEAM",
          name: "Room service pooled team split",
          description: "Room service tips route fully into the Room Service Team Pool.",
          priority: 200,
          isActive: true,
          effectiveFrom: currentPeriodStart,
          lines: {
            create: [
              {
                recipientType: AllocationRecipientType.POOL,
                poolId: roomServiceTeamPool.id,
                percentageBps: 10000,
                sortOrder: 1,
              },
            ],
          },
        },
      }),
      prisma.allocationRule.create({
        data: {
          venueId: portmarnock.id,
          departmentId: eventsDepartment.id,
          scope: "DEPARTMENT",
          selectionType: "TEAM",
          name: "M&E pooled team split",
          description: "Meetings and events team tips route into the Event Team Pool.",
          priority: 200,
          isActive: true,
          effectiveFrom: currentPeriodStart,
          lines: {
            create: [
              {
                recipientType: AllocationRecipientType.POOL,
                poolId: eventTeamPool.id,
                percentageBps: 10000,
                sortOrder: 1,
              },
            ],
          },
        },
      }),
      prisma.allocationRule.create({
        data: {
          venueId: portmarnock.id,
          departmentId: eventsDepartment.id,
          scope: "DEPARTMENT",
          selectionType: "INDIVIDUAL",
          name: "M&E direct to selected employee",
          description: "Meetings and events individual tips route fully to the selected employee.",
          priority: 220,
          isActive: true,
          effectiveFrom: currentPeriodStart,
          lines: {
            create: [
              {
                recipientType: AllocationRecipientType.SELECTED_STAFF,
                percentageBps: 10000,
                sortOrder: 1,
              },
            ],
          },
        },
      }),
      prisma.allocationRule.create({
        data: {
          venueId: portmarnock.id,
          departmentId: eventsDepartment.id,
          scope: "DEPARTMENT",
          selectionType: "TEAM",
          name: "Legacy banquet split",
          description: "Inactive historical rule kept for demo audit trail.",
          priority: 90,
          isActive: false,
          effectiveFrom: previousPeriodStart,
          effectiveTo: previousPeriodEnd,
          lines: {
            create: [
              {
                recipientType: AllocationRecipientType.POOL,
                poolId: eventBarPool.id,
                percentageBps: 10000,
                sortOrder: 1,
              },
            ],
          },
        },
      }),
    ]);

  const serviceAreas = {
    breakfast: [tableCardA, tableCardB, hostStand],
    roomService: [trayCard, inRoomTentCard],
    events: [ballroomEventSign, conferenceFoyerSign, privateDiningQr],
  };

  const breakfastIndividualRotation = [
    breakfastByName.Olivia,
    breakfastByName.Daniel,
    breakfastByName.Olivia,
    breakfastByName.Harper,
    breakfastByName.Olivia,
    breakfastByName.Sean,
  ];
  const eventsIndividualRotation = [
    eventsByName.Katherine,
    eventsByName.Peter,
    eventsByName.Katherine,
    eventsByName.Amelia,
    eventsByName.Katherine,
    eventsByName.Sofia,
  ];

  const successfulTransactions: SuccessfulSeedTransaction[] = [];
  const breakfastAmounts = [2, 5, 5, 10, 20];
  for (let index = 0; index < 30; index += 1) {
    const isIndividual = index % 5 !== 0 && index % 3 !== 0;
    const serviceArea = serviceAreas.breakfast[index % serviceAreas.breakfast.length];
    const selectedEmployee = isIndividual
      ? breakfastIndividualRotation[index % breakfastIndividualRotation.length]
      : null;
    successfulTransactions.push({
      venueId: newcastle.id,
      serviceAreaId: serviceArea.id,
      qrCodeSlug: serviceArea.slug,
      destinationPoolId: isIndividual ? null : breakfastTeamPool.id,
      destinationEmployeeId: selectedEmployee?.id ?? null,
      destinationType: QrDestinationType.SERVICE_AREA,
      guestSelectionType: isIndividual ? "INDIVIDUAL" : "TEAM",
      grossAmount: breakfastAmounts[index % breakfastAmounts.length],
      occurredAt: addHours(addDays(currentPeriodStart, index % 8), 7 + (index % 4)),
      rating: isIndividual && selectedEmployee?.firstName === "Olivia" ? 5 : index % 4 === 0 ? 4 : 5,
      payrollPeriodId: currentPeriod.id,
      poolMembers: isIndividual ? null : activeBreakfastPoolMembers,
      selectedEmployee,
    });
  }

  const roomServiceAmounts = [5, 10, 20, 5];
  for (let index = 0; index < 12; index += 1) {
    const serviceArea = serviceAreas.roomService[index % serviceAreas.roomService.length];
    successfulTransactions.push({
      venueId: newcastle.id,
      serviceAreaId: serviceArea.id,
      qrCodeSlug: serviceArea.slug,
      destinationPoolId: roomServiceTeamPool.id,
      destinationEmployeeId: null,
      destinationType: QrDestinationType.SERVICE_AREA,
      guestSelectionType: "TEAM",
      grossAmount: roomServiceAmounts[index % roomServiceAmounts.length],
      occurredAt: addHours(addDays(currentPeriodStart, index % 6), 11 + (index % 5)),
      rating: index % 3 === 0 ? 5 : 4,
      payrollPeriodId: currentPeriod.id,
      poolMembers: activeRoomServicePoolMembers,
      selectedEmployee: null,
    });
  }

  const eventsAmounts = [5, 10, 20, 10, 20, 5];
  for (let index = 0; index < 24; index += 1) {
    const isIndividual = index % 3 !== 0;
    const serviceArea = serviceAreas.events[index % serviceAreas.events.length];
    const selectedEmployee = isIndividual
      ? eventsIndividualRotation[index % eventsIndividualRotation.length]
      : null;
    successfulTransactions.push({
      venueId: portmarnock.id,
      serviceAreaId: serviceArea.id,
      qrCodeSlug: serviceArea.slug,
      destinationPoolId: isIndividual ? null : eventTeamPool.id,
      destinationEmployeeId: selectedEmployee?.id ?? null,
      destinationType: QrDestinationType.SERVICE_AREA,
      guestSelectionType: isIndividual ? "INDIVIDUAL" : "TEAM",
      grossAmount: eventsAmounts[index % eventsAmounts.length],
      occurredAt: addHours(addDays(currentPeriodStart, index % 9), 12 + (index % 6)),
      rating:
        isIndividual && selectedEmployee?.firstName === "Katherine"
          ? 5
          : index % 4 === 0
            ? 4
            : 5,
      payrollPeriodId: currentPeriod.id,
      poolMembers: isIndividual ? null : activeEventsPoolMembers,
      selectedEmployee,
    });
  }

  const excludedTransactions = [
    {
      venueId: newcastle.id,
      serviceAreaId: tableCardA.id,
      qrCodeSlug: tableCardA.slug,
      destinationPoolId: null,
      destinationEmployeeId: breakfastByName.Olivia.id,
      destinationType: QrDestinationType.SERVICE_AREA,
      guestSelectionType: "INDIVIDUAL" as TipSelectionType,
      grossAmount: 10,
      occurredAt: addHours(addDays(currentPeriodStart, 2), 8),
      payrollPeriodId: currentPeriod.id,
      status: TipTransactionStatus.FAILED,
    },
    {
      venueId: newcastle.id,
      serviceAreaId: hostStand.id,
      qrCodeSlug: hostStand.slug,
      destinationPoolId: breakfastTeamPool.id,
      destinationEmployeeId: null,
      destinationType: QrDestinationType.SERVICE_AREA,
      guestSelectionType: "TEAM" as TipSelectionType,
      grossAmount: 5,
      occurredAt: addHours(addDays(currentPeriodStart, 4), 9),
      payrollPeriodId: currentPeriod.id,
      status: TipTransactionStatus.REFUNDED,
    },
    {
      venueId: newcastle.id,
      serviceAreaId: trayCard.id,
      qrCodeSlug: trayCard.slug,
      destinationPoolId: roomServiceTeamPool.id,
      destinationEmployeeId: null,
      destinationType: QrDestinationType.SERVICE_AREA,
      guestSelectionType: "TEAM" as TipSelectionType,
      grossAmount: 20,
      occurredAt: addHours(addDays(currentPeriodStart, 5), 13),
      payrollPeriodId: currentPeriod.id,
      status: TipTransactionStatus.FAILED,
    },
    {
      venueId: portmarnock.id,
      serviceAreaId: ballroomEventSign.id,
      qrCodeSlug: ballroomEventSign.slug,
      destinationPoolId: eventTeamPool.id,
      destinationEmployeeId: null,
      destinationType: QrDestinationType.SERVICE_AREA,
      guestSelectionType: "TEAM" as TipSelectionType,
      grossAmount: 20,
      occurredAt: addHours(addDays(currentPeriodStart, 7), 17),
      payrollPeriodId: currentPeriod.id,
      status: TipTransactionStatus.REFUNDED,
    },
    {
      venueId: portmarnock.id,
      serviceAreaId: privateDiningQr.id,
      qrCodeSlug: privateDiningQr.slug,
      destinationPoolId: null,
      destinationEmployeeId: eventsByName.Katherine.id,
      destinationType: QrDestinationType.SERVICE_AREA,
      guestSelectionType: "INDIVIDUAL" as TipSelectionType,
      grossAmount: 10,
      occurredAt: addHours(addDays(currentPeriodStart, 8), 20),
      payrollPeriodId: currentPeriod.id,
      status: TipTransactionStatus.FAILED,
    },
  ];

  for (const transaction of successfulTransactions) {
    const grossAmount = asMoney(transaction.grossAmount);
    const tipitFeeAmount = asMoney(grossAmount * 0.0475);
    const netAmount = asMoney(grossAmount - tipitFeeAmount);
    const tipTransaction = await prisma.tipTransaction.create({
      data: {
        customerId: sandman.id,
        venueId: transaction.venueId,
        payrollPeriodId: transaction.payrollPeriodId,
        qrCodeSlug: transaction.qrCodeSlug,
        destinationType: transaction.destinationType,
        destinationEmployeeId: transaction.destinationEmployeeId,
        destinationPoolId: transaction.destinationPoolId,
        destinationVenueId: transaction.venueId,
        destinationServiceAreaId: transaction.serviceAreaId,
        guestSelectionType: transaction.guestSelectionType,
        currency: sandman.currency,
        grossAmount,
        tipitFeeAmount,
        netAmount,
        status: TipTransactionStatus.SUCCEEDED,
        rating: transaction.rating,
        ratedAt: transaction.occurredAt,
        occurredAt: transaction.occurredAt,
        stripeCheckoutId: `demo_${transaction.qrCodeSlug}_${transaction.occurredAt.getTime()}`,
      },
    });

    if (transaction.guestSelectionType === "INDIVIDUAL" && transaction.selectedEmployee) {
      await prisma.allocationResult.create({
        data: {
          customerId: sandman.id,
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
      const weightedGross = splitWeighted(
        grossAmount,
        transaction.poolMembers.map((member) => ({ employeeId: member.id, weight: member.hoursWorked })),
      );
      const weightedNet = splitWeighted(
        netAmount,
        transaction.poolMembers.map((member) => ({ employeeId: member.id, weight: member.hoursWorked })),
      );

      await prisma.allocationResult.createMany({
        data: weightedGross.map((grossShare, index) => ({
          customerId: sandman.id,
          venueId: transaction.venueId,
          payrollPeriodId: transaction.payrollPeriodId,
          tipTransactionId: tipTransaction.id,
          employeeId: grossShare.employeeId,
          poolId: transaction.destinationPoolId,
          grossAmount: grossShare.amount,
          netAmount: weightedNet[index]?.amount ?? 0,
        })),
      });
    }
  }

  for (const transaction of excludedTransactions) {
    const grossAmount = asMoney(transaction.grossAmount);
    const tipitFeeAmount = asMoney(grossAmount * 0.0475);
    const netAmount = asMoney(grossAmount - tipitFeeAmount);
    await prisma.tipTransaction.create({
      data: {
        customerId: sandman.id,
        venueId: transaction.venueId,
        payrollPeriodId: transaction.payrollPeriodId,
        qrCodeSlug: transaction.qrCodeSlug,
        destinationType: transaction.destinationType,
        destinationEmployeeId: transaction.destinationEmployeeId,
        destinationPoolId: transaction.destinationPoolId,
        destinationVenueId: transaction.venueId,
        destinationServiceAreaId: transaction.serviceAreaId,
        guestSelectionType: transaction.guestSelectionType,
        currency: sandman.currency,
        grossAmount,
        tipitFeeAmount,
        netAmount,
        status: transaction.status,
        occurredAt: transaction.occurredAt,
      },
    });
  }

  const hoursWorkedRows = [
    ...breakfastStaff.filter((staff) => staff.hoursWorked > 0),
    ...roomServiceStaff.filter((staff) => staff.hoursWorked > 0),
    ...eventsStaff.filter((staff) => staff.hoursWorked > 0),
  ];

  for (const staff of hoursWorkedRows) {
    const chunks = staff.hoursWorked > 30 ? [0.45, 0.35, 0.2] : [0.55, 0.45];
    let remaining = staff.hoursWorked;

    for (let index = 0; index < chunks.length; index += 1) {
      const hours =
        index === chunks.length - 1 ? remaining : asMoney(staff.hoursWorked * chunks[index]);
      remaining = asMoney(remaining - hours);
      const workDate = addDays(currentPeriodStart, (index * 3 + staff.firstName.length) % 10);
      await prisma.importedHoursWorked.create({
        data: {
          customerId: sandman.id,
          venueId: staff.venueId,
          departmentId: staff.departmentId,
          staffMemberId: staff.id,
          integrationProvider: IntegrationProvider.AMEEGO,
          externalRecordRef: `${staff.externalPayrollRef}-${index + 1}`,
          sourceSystemName: "Ameego",
          status: "SUCCEEDED",
          workDate,
          shiftStartsAt: addHours(workDate, 7 + index),
          shiftEndsAt: addHours(workDate, 7 + index + Math.max(hours, 4)),
          hoursWorked: hours,
          rawPayload: {
            demo: true,
            staffCode: staff.staffCode,
          },
        },
      });
    }
  }

  await prisma.auditLog.createMany({
    data: [
      {
        userId: tipitAdmin.id,
        customerId: sandman.id,
        entityType: "Customer",
        entityId: sandman.id,
        action: "customer.created",
        summary: "Created Sandman Hotel Group UK hospitality pilot.",
      },
      {
        userId: sandmanAdminUser.id,
        customerId: sandman.id,
        customerUserId: sandmanCustomerAdmin.id,
        venueId: newcastle.id,
        entityType: "ServiceArea",
        entityId: hostStand.id,
        action: "service-area.created",
        summary: "Created Breakfast Host Stand QR journey.",
      },
      {
        userId: sandmanManagerUser.id,
        customerId: sandman.id,
        customerUserId: sandmanCustomerManager.id,
        venueId: portmarnock.id,
        entityType: "Shift",
        entityId: eventsActiveShift.id,
        action: "shift.started",
        summary: "Started the live conference and events shift.",
      },
      {
        userId: sandmanAdminUser.id,
        customerId: sandman.id,
        customerUserId: sandmanCustomerAdmin.id,
        venueId: portmarnock.id,
        entityType: "AllocationRule",
        entityId: legacyRule.id,
        action: "allocation-rule.updated",
        summary: "Retired the legacy banquet allocation rule for historical reference.",
      },
      {
        userId: sandmanViewerUser.id,
        customerId: sandman.id,
        customerUserId: sandmanCustomerViewer.id,
        venueId: newcastle.id,
        entityType: "QrAsset",
        entityId: tableCardA.id,
        action: "qr-asset.previewed",
        summary: "Viewed printable preview for Breakfast Table Card A.",
      },
    ],
  });

  console.log("Seeded Sandman Hotel Group UK hospitality pilot demo.");
  console.log(`Venues: ${newcastle.name}, ${portmarnock.name}`);
  console.log("Enabled departments: Breakfast, Room Service, Meeting & Events");
  console.log("Disabled departments: Bar, Restaurant");
  console.log("Test credentials: admin@sandman.example / Password123!, manager@sandman.example / Password123!, viewer@sandman.example / Password123!");
  console.log(
    "Sample URLs: /tip/ssn-breakfast-table-card-a, /tip/ssn-room-service-tray-card, /tip/pmr-ballroom-event-sign",
  );
  console.log(
    `Rules seeded: ${[
      breakfastTeamRule,
      breakfastIndividualRule,
      roomServiceTeamRule,
      eventsTeamRule,
      eventsIndividualRule,
      legacyRule,
    ].length}`,
  );
  console.log("Successful tips seeded: Breakfast 30, Room Service 12, Meetings & Events 24, plus failed/refunded examples.");
}
