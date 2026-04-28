import type { PrismaClient, ShiftStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "../../../../lib/prisma";
import { NotFoundError, ValidationAppError } from "../../../shared/errors/app-error";
import type { AuthenticatedUser } from "../../../shared/auth/types";
import type {
  CreateShiftAssignmentInput,
  CreateShiftInput,
  EndShiftInput,
  StartShiftInput,
  UpdateShiftAssignmentInput,
  UpdateShiftInput,
} from "./shifts.schemas";

type ListShiftsInput = {
  customerId?: string;
  venueId?: string;
  departmentId?: string;
  status?: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  page: number;
  pageSize: number;
};

function buildWhere(input: Omit<ListShiftsInput, "page" | "pageSize">): Prisma.ShiftWhereInput {
  return {
    customerId: input.customerId,
    venueId: input.venueId,
    departmentId: input.departmentId,
    status: input.status,
  };
}

export class ShiftsService {
  constructor(
    private readonly db: Pick<
      PrismaClient,
      | "shift"
      | "venue"
      | "department"
      | "staffMember"
      | "departmentStaffAssignment"
      | "auditLog"
      | "$transaction"
    > = prisma,
  ) {}

  private readonly shiftInclude = {
    venue: {
      select: { id: true, name: true },
    },
    department: {
      select: { id: true, name: true, revenueCentreType: true },
    },
    staffAssignments: {
      include: {
        staffMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc" as const,
      },
    },
  } satisfies Prisma.ShiftInclude;

  async list(input: ListShiftsInput) {
    const where = buildWhere(input);
    const [items, total] = await Promise.all([
      this.db.shift.findMany({
        where,
        include: this.shiftInclude,
        orderBy: [{ startsAt: "desc" }, { name: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.db.shift.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      },
    };
  }

  async getById(shiftId: string, customerId?: string) {
    const shift = await this.db.shift.findFirst({
      where: {
        id: shiftId,
        customerId,
      },
      include: this.shiftInclude,
    });

    if (!shift) {
      throw new NotFoundError("Shift not found");
    }

    return shift;
  }

  async create(customerId: string, input: CreateShiftInput) {
    this.validateShiftWindow(input.startsAt, input.endsAt);
    await this.validateVenueAndDepartment(customerId, input.venueId, input.departmentId);
    if (input.status === "ACTIVE") {
      await this.assertNoOtherActiveShift(customerId, input.venueId, input.departmentId);
    }

    return this.db.shift.create({
      data: {
        customerId,
        venueId: input.venueId,
        departmentId: input.departmentId,
        name: input.name,
        timezone: input.timezone,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: input.status,
      },
      include: {
        staffAssignments: true,
      },
    });
  }

  async update(customerId: string, shiftId: string, input: UpdateShiftInput) {
    const shift = await this.db.shift.findFirst({
      where: { id: shiftId, customerId },
    });

    if (!shift) {
      throw new NotFoundError("Shift not found");
    }

    const venueId = input.venueId ?? shift.venueId;
    const departmentId = input.departmentId ?? shift.departmentId;
    const startsAt = input.startsAt ?? shift.startsAt;
    const endsAt = input.endsAt ?? shift.endsAt;

    this.validateShiftWindow(startsAt, endsAt);

    if (input.venueId || input.departmentId) {
      await this.validateVenueAndDepartment(customerId, venueId, departmentId);
    }

    if (input.status === "ACTIVE") {
      await this.assertNoOtherActiveShift(customerId, venueId, departmentId, shiftId);
    }

    return this.db.shift.update({
      where: { id: shiftId },
      data: input,
      include: {
        staffAssignments: true,
      },
    });
  }

  async startShift(customerId: string, shiftId: string, actor: AuthenticatedUser, input: StartShiftInput) {
    const shift = await this.getById(shiftId, customerId);
    const startedAt = input.startedAt ?? new Date();

    if (shift.status === "COMPLETED" || shift.status === "CANCELLED") {
      throw new ValidationAppError("Only scheduled or already-active shifts can be started.");
    }

    if (shift.endsAt <= startedAt) {
      throw new ValidationAppError("This shift cannot be started because its end time has already passed.");
    }

    await this.assertNoOtherActiveShift(customerId, shift.venueId, shift.departmentId, shift.id);

    const previousSnapshot = this.toAuditSnapshot(shift);

    return this.db.$transaction(async (tx) => {
      const updated = await tx.shift.update({
        where: { id: shiftId },
        data: {
          status: "ACTIVE",
          startsAt: startedAt,
        },
        include: this.shiftInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          customerId,
          customerUserId: actor.customerUserId,
          entityType: "Shift",
          entityId: shiftId,
          action: "ACTIVATE",
          summary: `Started shift ${updated.name}`,
          metadata: {
            activationMode: "MANUAL",
          },
          beforeData: previousSnapshot,
          afterData: this.toAuditSnapshot(updated),
        },
      });

      return updated;
    });
  }

  async endShift(customerId: string, shiftId: string, actor: AuthenticatedUser, input: EndShiftInput) {
    const shift = await this.getById(shiftId, customerId);
    const endedAt = input.endedAt ?? new Date();

    if (shift.status !== "ACTIVE") {
      throw new ValidationAppError("Only active shifts can be ended.");
    }

    if (endedAt < shift.startsAt) {
      throw new ValidationAppError("Shift end time cannot be before the shift start time.");
    }

    const previousSnapshot = this.toAuditSnapshot(shift);

    return this.db.$transaction(async (tx) => {
      const updated = await tx.shift.update({
        where: { id: shiftId },
        data: {
          status: "COMPLETED",
          endsAt: endedAt,
        },
        include: this.shiftInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          customerId,
          customerUserId: actor.customerUserId,
          entityType: "Shift",
          entityId: shiftId,
          action: "DEACTIVATE",
          summary: `Ended shift ${updated.name}`,
          metadata: {
            closureMode: "MANUAL",
          },
          beforeData: previousSnapshot,
          afterData: this.toAuditSnapshot(updated),
        },
      });

      return updated;
    });
  }

  async remove(customerId: string, shiftId: string) {
    const shift = await this.db.shift.findFirst({
      where: { id: shiftId, customerId },
    });

    if (!shift) {
      throw new NotFoundError("Shift not found");
    }

    await this.db.shift.delete({
      where: { id: shiftId },
    });

    return { id: shiftId, deleted: true as const };
  }

  async addAssignment(customerId: string, shiftId: string, input: CreateShiftAssignmentInput) {
    const shift = await this.getOwnedShift(customerId, shiftId);
    await this.validateAssignment(customerId, shift, input.staffMemberId);

    return this.db.shift.update({
      where: { id: shiftId },
      data: {
        staffAssignments: {
          create: {
            staffMemberId: input.staffMemberId,
            role: input.role,
            eligibleForTips: input.eligibleForTips,
          },
        },
      },
      include: {
        staffAssignments: {
          include: {
            staffMember: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                status: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
  }

  async updateAssignment(
    customerId: string,
    shiftId: string,
    assignmentId: string,
    input: UpdateShiftAssignmentInput,
  ) {
    const shift = await this.getOwnedShift(customerId, shiftId);
    const assignment = shift.staffAssignments.find((candidate) => candidate.id === assignmentId);

    if (!assignment) {
      throw new NotFoundError("Shift assignment not found");
    }

    if (input.staffMemberId && input.staffMemberId !== assignment.staffMemberId) {
      await this.validateAssignment(customerId, shift, input.staffMemberId);
    }

    return this.db.shift.update({
      where: { id: shiftId },
      data: {
        staffAssignments: {
          update: {
            where: { id: assignmentId },
            data: input,
          },
        },
      },
      include: {
        staffAssignments: {
          include: {
            staffMember: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                status: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
  }

  async removeAssignment(customerId: string, shiftId: string, assignmentId: string) {
    const shift = await this.getOwnedShift(customerId, shiftId);
    const assignment = shift.staffAssignments.find((candidate) => candidate.id === assignmentId);

    if (!assignment) {
      throw new NotFoundError("Shift assignment not found");
    }

    await this.db.shift.update({
      where: { id: shiftId },
      data: {
        staffAssignments: {
          delete: {
            id: assignmentId,
          },
        },
      },
    });

    return { id: assignmentId, deleted: true as const };
  }

  private async getOwnedShift(customerId: string, shiftId: string) {
    const shift = await this.db.shift.findFirst({
      where: { id: shiftId, customerId },
      include: {
        staffAssignments: true,
      },
    });

    if (!shift) {
      throw new NotFoundError("Shift not found");
    }

    return shift;
  }

  private validateShiftWindow(startsAt: Date, endsAt: Date) {
    if (endsAt <= startsAt) {
      throw new ValidationAppError("Shift end time must be after the start time.");
    }
  }

  private async validateVenueAndDepartment(customerId: string, venueId: string, departmentId: string) {
    const [venue, department] = await Promise.all([
      this.db.venue.findFirst({
        where: { id: venueId, customerId },
        select: { id: true },
      }),
      this.db.department.findFirst({
        where: { id: departmentId, customerId },
        select: { id: true, venueId: true },
      }),
    ]);

    if (!venue) {
      throw new NotFoundError("Venue not found");
    }

    if (!department) {
      throw new NotFoundError("Department not found");
    }

    if (department.venueId !== venueId) {
      throw new ValidationAppError("Shift departments must belong to the same venue as the shift.");
    }
  }

  private async validateAssignment(
    customerId: string,
    shift: { venueId: string; departmentId: string },
    staffMemberId: string,
  ) {
    const [staffMember, departmentAssignment] = await Promise.all([
      this.db.staffMember.findFirst({
        where: {
          id: staffMemberId,
          customerId,
        },
        select: {
          id: true,
          venueId: true,
        },
      }),
      this.db.departmentStaffAssignment.findFirst({
        where: {
          staffMemberId,
          customerId,
          venueId: shift.venueId,
          departmentId: shift.departmentId,
          isActive: true,
        },
        select: {
          id: true,
        },
      }),
    ]);

    if (!staffMember) {
      throw new NotFoundError("Staff member not found");
    }

    if (staffMember.venueId !== shift.venueId) {
      throw new ValidationAppError("Shift staff assignments must belong to the same venue as the shift.");
    }

    if (!departmentAssignment) {
      throw new ValidationAppError(
        "Staff members must be assigned to the shift department before they can join that shift.",
      );
    }
  }

  private async assertNoOtherActiveShift(
    customerId: string,
    venueId: string,
    departmentId: string,
    excludeShiftId?: string,
  ) {
    const conflictingShift = await this.db.shift.findFirst({
      where: {
        customerId,
        venueId,
        departmentId,
        status: "ACTIVE",
        id: excludeShiftId ? { not: excludeShiftId } : undefined,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (conflictingShift) {
      throw new ValidationAppError(
        `Only one active shift can exist for this department at a time. ${conflictingShift.name} is already active.`,
      );
    }
  }

  private toAuditSnapshot(shift: {
    id: string;
    customerId: string;
    venueId: string;
    departmentId: string;
    name: string;
    timezone: string;
    startsAt: Date;
    endsAt: Date;
    status: ShiftStatus;
  }) {
    return {
      id: shift.id,
      customerId: shift.customerId,
      venueId: shift.venueId,
      departmentId: shift.departmentId,
      name: shift.name,
      timezone: shift.timezone,
      startsAt: shift.startsAt.toISOString(),
      endsAt: shift.endsAt.toISOString(),
      status: shift.status,
    };
  }
}
