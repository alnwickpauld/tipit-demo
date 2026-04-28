import type { PoolDistributionRunStatus, PoolHoursEntrySource, PrismaClient } from "@prisma/client";

import { prisma } from "../../../../lib/prisma";
import type { AuthenticatedUser } from "../../../shared/auth/types";
import { AuthorizationError, NotFoundError, ValidationAppError } from "../../../shared/errors/app-error";

type HoursEntryInput = {
  employeeId: string;
  hoursWorked: number;
  source: PoolHoursEntrySource;
};

type PoolDistributionInput = {
  poolTotal: number;
  employees: Array<{
    employeeId: string;
    employeeName: string;
    payrollReference: string | null;
    hoursWorked: number;
    hoursSource: PoolHoursEntrySource;
  }>;
};

type ExportFilters = {
  venueId?: string;
  payrollPeriodId: string;
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function roundHours(value: number) {
  return Number(value.toFixed(4));
}

function roundRate(value: number) {
  return Number(value.toFixed(8));
}

function sortEmployees<T extends { employeeName: string; employeeId: string }>(employees: T[]) {
  return [...employees].sort((left, right) => {
    const nameSort = left.employeeName.localeCompare(right.employeeName);
    if (nameSort !== 0) {
      return nameSort;
    }

    return left.employeeId.localeCompare(right.employeeId);
  });
}

export function calculatePoolDistribution(input: PoolDistributionInput) {
  if (!Number.isFinite(input.poolTotal) || input.poolTotal < 0) {
    throw new ValidationAppError("Pool total must be a valid positive amount or zero");
  }

  const seen = new Set<string>();
  for (const employee of input.employees) {
    if (seen.has(employee.employeeId)) {
      throw new ValidationAppError("Employees can only appear once in a pool distribution");
    }
    seen.add(employee.employeeId);

    if (!Number.isFinite(employee.hoursWorked) || employee.hoursWorked < 0) {
      throw new ValidationAppError("Hours worked must be 0 or greater");
    }
  }

  const employees = sortEmployees(
    input.employees.map((employee) => ({
      ...employee,
      hoursWorked: roundHours(employee.hoursWorked),
    })),
  );

  const totalHours = roundHours(employees.reduce((sum, employee) => sum + employee.hoursWorked, 0));
  if (totalHours <= 0) {
    throw new ValidationAppError("Distribution cannot run when total eligible hours are zero");
  }

  const poolTotal = roundMoney(input.poolTotal);
  const perHourRate = roundRate(poolTotal / totalHours);

  let allocatedBeforeFinal = 0;
  const lastIndex = employees.length - 1;

  const allocations = employees.map((employee, index) => {
    const rawAmount = employee.hoursWorked * perHourRate;
    const roundedAmount =
      index === lastIndex ? roundMoney(poolTotal - allocatedBeforeFinal) : roundMoney(rawAmount);

    if (index !== lastIndex) {
      allocatedBeforeFinal = roundMoney(allocatedBeforeFinal + roundedAmount);
    }

    return {
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      payrollReference: employee.payrollReference,
      hoursWorked: employee.hoursWorked,
      hoursSource: employee.hoursSource,
      allocationAmount: roundedAmount,
      rawAmount,
    };
  });

  const finalRawAmount = allocations[lastIndex]?.rawAmount ?? 0;
  const finalRoundedWithoutAdjustment = roundMoney(finalRawAmount);
  const finalRoundedWithAdjustment = allocations[lastIndex]?.allocationAmount ?? 0;
  const roundingAdjustment = roundMoney(finalRoundedWithAdjustment - finalRoundedWithoutAdjustment);

  return {
    poolTotal,
    totalHours,
    perHourRate,
    roundingAdjustment,
    allocations: allocations.map(({ rawAmount, ...allocation }) => allocation),
  };
}

export class PoolDistributionsService {
  constructor(
    private readonly db: Pick<
      PrismaClient,
      | "pool"
      | "poolMember"
      | "staffMember"
      | "payrollPeriod"
      | "poolHoursEntry"
      | "poolDistributionRun"
      | "poolDistributionAllocation"
      | "auditLog"
      | "$transaction"
    > = prisma,
  ) {}

  async getEligibleEmployees(customerId: string, input: { poolId: string; payrollPeriodId: string }) {
    const { pool, payrollPeriod, members, run } = await this.resolveContext(customerId, input);
    const hoursEntries = await this.db.poolHoursEntry.findMany({
      where: {
        poolId: pool.id,
        payrollPeriodId: payrollPeriod.id,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            payrollReference: true,
          },
        },
      },
      orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
    });

    const entryByEmployeeId = new Map(hoursEntries.map((entry) => [entry.employeeId, entry]));
    const allocations = run
      ? await this.db.poolDistributionAllocation.findMany({
          where: { runId: run.id },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                payrollReference: true,
              },
            },
          },
          orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
        })
      : [];

    return {
      pool: {
        id: pool.id,
        name: pool.name,
        poolType: pool.poolType,
        venueId: pool.venueId,
      },
      payrollPeriod: {
        id: payrollPeriod.id,
        label: payrollPeriod.label,
        startDate: payrollPeriod.startDate,
        endDate: payrollPeriod.endDate,
      },
      run: run
        ? {
            id: run.id,
            status: run.status,
            poolTotal: Number(run.poolTotal),
            totalHours: Number(run.totalHours),
            perHourRate: Number(run.perHourRate),
            roundingAdjustment: Number(run.roundingAdjustment),
          }
        : null,
      employees: sortEmployees(
        members.map((member) => {
          const employeeName =
            member.staffMember.displayName ??
            `${member.staffMember.firstName} ${member.staffMember.lastName}`.trim();
          const entry = entryByEmployeeId.get(member.staffMember.id);

          return {
            employeeId: member.staffMember.id,
            employeeName,
            payrollReference: member.staffMember.payrollReference,
            hoursWorked: Number(entry?.hoursWorked ?? 0),
            source: entry?.source ?? "MANUAL",
            status: entry?.status ?? "DRAFT",
          };
        }),
      ),
      allocations: allocations.map((allocation) => ({
        employeeId: allocation.employeeId,
        employeeName:
          allocation.employee.displayName ??
          `${allocation.employee.firstName} ${allocation.employee.lastName}`.trim(),
        payrollReference: allocation.employee.payrollReference,
        hoursWorked: Number(allocation.hoursWorked),
        allocationAmount: Number(allocation.allocationAmount),
        hoursSource: allocation.hoursSource,
      })),
    };
  }

  async saveHoursEntries(
    customerId: string,
    actor: AuthenticatedUser,
    input: { poolId: string; payrollPeriodId: string; poolTotal?: number; entries: HoursEntryInput[] },
  ) {
    const { pool, payrollPeriod, members, run } = await this.resolveContext(customerId, input);
    this.assertEditable(run);

    const memberByEmployeeId = new Map(
      members.map((member) => [
        member.staffMember.id,
        {
          employeeId: member.staffMember.id,
          employeeName:
            member.staffMember.displayName ??
            `${member.staffMember.firstName} ${member.staffMember.lastName}`.trim(),
          payrollReference: member.staffMember.payrollReference,
        },
      ]),
    );

    const seen = new Set<string>();
    for (const entry of input.entries) {
      if (seen.has(entry.employeeId)) {
        throw new ValidationAppError("Employees can only appear once in manual hours entry");
      }
      seen.add(entry.employeeId);

      if (!memberByEmployeeId.has(entry.employeeId)) {
        throw new ValidationAppError("Only pool-eligible employees can have hours entered");
      }

      if (!Number.isFinite(entry.hoursWorked) || entry.hoursWorked < 0) {
        throw new ValidationAppError("Hours worked must be 0 or greater");
      }
    }

    const normalizedEntries = Array.from(memberByEmployeeId.values()).map((employee) => {
      const entry = input.entries.find((candidate) => candidate.employeeId === employee.employeeId);
      return {
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        payrollReference: employee.payrollReference,
        hoursWorked: roundHours(entry?.hoursWorked ?? 0),
        hoursSource: entry?.source ?? "MANUAL",
      };
    });

    await this.db.$transaction(async (tx) => {
      for (const entry of normalizedEntries) {
        await tx.poolHoursEntry.upsert({
          where: {
            poolId_payrollPeriodId_employeeId: {
              poolId: pool.id,
              payrollPeriodId: payrollPeriod.id,
              employeeId: entry.employeeId,
            },
          },
          create: {
            customerId,
            venueId: pool.venueId,
            poolId: pool.id,
            payrollPeriodId: payrollPeriod.id,
            employeeId: entry.employeeId,
            hoursWorked: entry.hoursWorked,
            source: entry.hoursSource,
            status: "DRAFT",
            createdBy: actor.userId,
          },
          update: {
            hoursWorked: entry.hoursWorked,
            source: entry.hoursSource,
            status: "DRAFT",
            createdBy: actor.userId,
          },
        });
      }

      if (run) {
        await tx.poolDistributionRun.update({
          where: { id: run.id },
          data: {
            poolTotal: input.poolTotal ?? Number(run.poolTotal),
            status: run.status === "EXPORTED" ? "EXPORTED" : "DRAFT",
            createdBy: actor.userId,
          },
        });
      } else if (typeof input.poolTotal === "number") {
        await tx.poolDistributionRun.create({
          data: {
            customerId,
            venueId: pool.venueId,
            poolId: pool.id,
            payrollPeriodId: payrollPeriod.id,
            poolTotal: roundMoney(input.poolTotal),
            totalHours: 0,
            perHourRate: 0,
            roundingAdjustment: 0,
            status: "DRAFT",
            createdBy: actor.userId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          customerId,
          customerUserId: actor.customerUserId,
          venueId: pool.venueId,
          poolId: pool.id,
          entityType: "PoolHoursEntry",
          entityId: `${pool.id}:${payrollPeriod.id}`,
          action: "pool-distribution.hours.saved",
          summary: `Saved manual hours for ${pool.name}`,
          afterData: {
            payrollPeriodId: payrollPeriod.id,
            entries: normalizedEntries,
          },
          metadata: {
            source: "MANUAL",
            payrollPeriodId: payrollPeriod.id,
          },
        },
      });
    });

    return this.getEligibleEmployees(customerId, input);
  }

  async previewDistribution(
    customerId: string,
    actor: AuthenticatedUser,
    input: { poolId: string; payrollPeriodId: string; poolTotal: number },
  ) {
    const { pool, payrollPeriod, members, run } = await this.resolveContext(customerId, input);
    this.assertEditable(run);
    const distributionInput = await this.buildDistributionInput(customerId, pool.id, payrollPeriod.id, members, input.poolTotal);
    const distribution = calculatePoolDistribution(distributionInput);

    const nextRun = await this.db.$transaction(async (tx) => {
      const draftRun = run
        ? await tx.poolDistributionRun.update({
            where: { id: run.id },
            data: {
              poolTotal: distribution.poolTotal,
              totalHours: distribution.totalHours,
              perHourRate: distribution.perHourRate,
              roundingAdjustment: distribution.roundingAdjustment,
              status: "READY_FOR_REVIEW",
              createdBy: actor.userId,
            },
          })
        : await tx.poolDistributionRun.create({
            data: {
              customerId,
              venueId: pool.venueId,
              poolId: pool.id,
              payrollPeriodId: payrollPeriod.id,
              poolTotal: distribution.poolTotal,
              totalHours: distribution.totalHours,
              perHourRate: distribution.perHourRate,
              roundingAdjustment: distribution.roundingAdjustment,
              status: "READY_FOR_REVIEW",
              createdBy: actor.userId,
            },
          });

      await tx.poolDistributionAllocation.deleteMany({ where: { runId: draftRun.id } });
      if (distribution.allocations.length > 0) {
        await tx.poolDistributionAllocation.createMany({
          data: distribution.allocations.map((allocation) => ({
            customerId,
            venueId: pool.venueId,
            poolId: pool.id,
            payrollPeriodId: payrollPeriod.id,
            runId: draftRun.id,
            employeeId: allocation.employeeId,
            hoursWorked: allocation.hoursWorked,
            allocationAmount: allocation.allocationAmount,
            hoursSource: allocation.hoursSource,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          customerId,
          customerUserId: actor.customerUserId,
          venueId: pool.venueId,
          poolId: pool.id,
          entityType: "PoolDistributionRun",
          entityId: draftRun.id,
          action: "pool-distribution.previewed",
          summary: `Previewed ${pool.name} distribution`,
          afterData: {
            poolTotal: distribution.poolTotal,
            totalHours: distribution.totalHours,
            perHourRate: distribution.perHourRate,
            roundingAdjustment: distribution.roundingAdjustment,
          },
          metadata: {
            payrollPeriodId: payrollPeriod.id,
          },
        },
      });

      return draftRun;
    });

    return {
      runId: nextRun.id,
      status: "READY_FOR_REVIEW" as PoolDistributionRunStatus,
      pool: {
        id: pool.id,
        name: pool.name,
        poolType: pool.poolType,
      },
      payrollPeriod: {
        id: payrollPeriod.id,
        label: payrollPeriod.label,
        startDate: payrollPeriod.startDate,
        endDate: payrollPeriod.endDate,
      },
      poolTotal: distribution.poolTotal,
      totalHours: distribution.totalHours,
      perHourRate: distribution.perHourRate,
      roundingAdjustment: distribution.roundingAdjustment,
      allocations: distribution.allocations,
    };
  }

  async lockDistribution(
    customerId: string,
    actor: AuthenticatedUser,
    input: { poolId: string; payrollPeriodId: string; poolTotal: number },
  ) {
    const preview = await this.previewDistribution(customerId, actor, input);

    await this.db.$transaction(async (tx) => {
      await tx.poolDistributionRun.update({
        where: { id: preview.runId },
        data: {
          status: "LOCKED",
        },
      });

      await tx.poolHoursEntry.updateMany({
        where: {
          poolId: input.poolId,
          payrollPeriodId: input.payrollPeriodId,
        },
        data: {
          status: "LOCKED",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          customerId,
          customerUserId: actor.customerUserId,
          venueId: null,
          poolId: input.poolId,
          entityType: "PoolDistributionRun",
          entityId: preview.runId,
          action: "pool-distribution.locked",
          summary: `Locked pool distribution for ${preview.pool.name}`,
          afterData: {
            status: "LOCKED",
            payrollPeriodId: input.payrollPeriodId,
          },
        },
      });
    });

    return {
      ...preview,
      status: "LOCKED" as PoolDistributionRunStatus,
    };
  }

  async unlockDistribution(customerId: string, runId: string, actor: AuthenticatedUser) {
    if (actor.role !== "CUSTOMER_ADMIN" && actor.role !== "TIPIT_ADMIN") {
      throw new AuthorizationError("Only admin users can unlock a pool distribution");
    }

    const run = await this.db.poolDistributionRun.findFirst({
      where: {
        id: runId,
        customerId,
      },
      include: {
        pool: {
          select: {
            id: true,
            name: true,
            venueId: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundError("Pool distribution run not found");
    }

    if (run.status === "EXPORTED") {
      throw new ValidationAppError("Exported distributions cannot be unlocked");
    }

    await this.db.$transaction(async (tx) => {
      await tx.poolDistributionAllocation.deleteMany({
        where: { runId: run.id },
      });

      await tx.poolDistributionRun.update({
        where: { id: run.id },
        data: {
          status: "DRAFT",
          totalHours: 0,
          perHourRate: 0,
          roundingAdjustment: 0,
        },
      });

      await tx.poolHoursEntry.updateMany({
        where: {
          poolId: run.poolId,
          payrollPeriodId: run.payrollPeriodId,
        },
        data: {
          status: "DRAFT",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          customerId,
          customerUserId: actor.customerUserId,
          venueId: run.venueId,
          poolId: run.poolId,
          entityType: "PoolDistributionRun",
          entityId: run.id,
          action: "pool-distribution.unlocked",
          summary: `Unlocked pool distribution for ${run.pool.name}`,
          beforeData: {
            status: run.status,
          },
          afterData: {
            status: "DRAFT",
          },
        },
      });
    });

    return {
      id: run.id,
      unlocked: true as const,
    };
  }

  async generatePayrollExportRows(customerId: string, filters: ExportFilters) {
    const runs = await this.db.poolDistributionRun.findMany({
      where: {
        customerId,
        payrollPeriodId: filters.payrollPeriodId,
        status: { in: ["LOCKED", "EXPORTED"] },
        ...(filters.venueId ? { venueId: filters.venueId } : {}),
      },
      include: {
        pool: {
          select: {
            id: true,
            name: true,
          },
        },
        allocations: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                payrollReference: true,
              },
            },
          },
        },
      },
      orderBy: [{ pool: { name: "asc" } }],
    });

    return runs.flatMap((run) =>
      sortEmployees(
        run.allocations.map((allocation) => ({
          employeeId: allocation.employeeId,
          employeeName:
            allocation.employee.displayName ??
            `${allocation.employee.firstName} ${allocation.employee.lastName}`.trim(),
          payrollReference: allocation.employee.payrollReference,
          poolName: run.pool.name,
          poolId: run.poolId,
          poolAllocation: Number(allocation.allocationAmount),
          hoursWorked: Number(allocation.hoursWorked),
          hoursSource: allocation.hoursSource,
          runStatus: run.status,
        })),
      ),
    );
  }

  private assertEditable(run: { status: PoolDistributionRunStatus } | null) {
    if (run && (run.status === "LOCKED" || run.status === "EXPORTED")) {
      throw new ValidationAppError("Locked distributions cannot be edited until they are explicitly unlocked");
    }
  }

  private async resolveContext(customerId: string, input: { poolId: string; payrollPeriodId: string }) {
    const [pool, payrollPeriod, run] = await Promise.all([
      this.db.pool.findFirst({
        where: { id: input.poolId, customerId },
        select: {
          id: true,
          name: true,
          poolType: true,
          venueId: true,
        },
      }),
      this.db.payrollPeriod.findFirst({
        where: { id: input.payrollPeriodId, customerId },
        select: {
          id: true,
          label: true,
          startDate: true,
          endDate: true,
        },
      }),
      this.db.poolDistributionRun.findFirst({
        where: {
          poolId: input.poolId,
          payrollPeriodId: input.payrollPeriodId,
          customerId,
        },
      }),
    ]);

    if (!pool) {
      throw new NotFoundError("Pool not found");
    }

    if (!payrollPeriod) {
      throw new NotFoundError("Payroll period not found");
    }

    const members = await this.db.poolMember.findMany({
      where: {
        poolId: pool.id,
        isActive: true,
        joinedAt: { lte: payrollPeriod.endDate },
        OR: [{ leftAt: null }, { leftAt: { gte: payrollPeriod.startDate } }],
      },
      include: {
        staffMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            payrollReference: true,
            status: true,
          },
        },
      },
    });

    const activeMembers = members.filter((member) => member.staffMember.status === "ACTIVE");

    return {
      pool,
      payrollPeriod,
      run,
      members: activeMembers,
    };
  }

  private async buildDistributionInput(
    customerId: string,
    poolId: string,
    payrollPeriodId: string,
    members: Array<{
      staffMember: {
        id: string;
        firstName: string;
        lastName: string;
        displayName: string | null;
        payrollReference: string | null;
      };
    }>,
    poolTotal: number,
  ): Promise<PoolDistributionInput> {
    const hoursEntries = await this.db.poolHoursEntry.findMany({
      where: {
        customerId,
        poolId,
        payrollPeriodId,
        employeeId: { in: members.map((member) => member.staffMember.id) },
      },
      select: {
        employeeId: true,
        hoursWorked: true,
        source: true,
      },
    });

    const entryByEmployeeId = new Map(hoursEntries.map((entry) => [entry.employeeId, entry]));

    return {
      poolTotal,
      employees: members.map((member) => {
        const employeeName =
          member.staffMember.displayName ??
          `${member.staffMember.firstName} ${member.staffMember.lastName}`.trim();
        const entry = entryByEmployeeId.get(member.staffMember.id);

        return {
          employeeId: member.staffMember.id,
          employeeName,
          payrollReference: member.staffMember.payrollReference,
          hoursWorked: Number(entry?.hoursWorked ?? 0),
          hoursSource: entry?.source ?? "MANUAL",
        };
      }),
    };
  }
}
