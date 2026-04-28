import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "../../../../lib/prisma";
import { NotFoundError, ValidationAppError } from "../../../shared/errors/app-error";
import type { CreateStaffInput, UpdateStaffInput } from "./staff.schemas";

type ListStaffInput = {
  customerId?: string;
  venueId?: string;
  departmentId?: string;
};

function buildWhere(input: ListStaffInput): Prisma.StaffMemberWhereInput {
  return {
    customerId: input.customerId,
    venueId: input.venueId,
    departmentAssignments: input.departmentId
      ? {
          some: {
            departmentId: input.departmentId,
            isActive: true,
          },
        }
      : undefined,
  };
}

export class StaffService {
  constructor(
    private readonly db: Pick<
      PrismaClient,
      "staffMember" | "venue" | "department" | "departmentStaffAssignment"
    > = prisma,
  ) {}

  async list(input: ListStaffInput) {
    return this.db.staffMember.findMany({
      where: buildWhere(input),
      orderBy: [{ venue: { name: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
      include: {
        venue: { select: { id: true, name: true } },
        departmentAssignments: {
          where: { isActive: true },
          orderBy: [{ isPrimary: "desc" }, { department: { name: "asc" } }],
          include: {
            department: { select: { id: true, name: true, revenueCentreType: true } },
          },
        },
      },
    });
  }

  async getById(staffMemberId: string, customerId?: string) {
    const staffMember = await this.db.staffMember.findFirst({
      where: {
        id: staffMemberId,
        customerId,
      },
      include: {
        venue: { select: { id: true, name: true } },
        departmentAssignments: {
          where: { isActive: true },
          orderBy: [{ isPrimary: "desc" }, { department: { name: "asc" } }],
          include: {
            department: { select: { id: true, name: true, revenueCentreType: true } },
          },
        },
      },
    });

    if (!staffMember) {
      throw new NotFoundError("Staff member not found");
    }

    return staffMember;
  }

  async create(customerId: string, input: CreateStaffInput) {
    const departmentIds = input.departmentIds ?? [];
    await this.validateVenueAndDepartments(customerId, input.venueId, departmentIds);

    return this.db.staffMember.create({
      data: {
        customerId,
        venueId: input.venueId,
        externalPayrollRef: input.externalPayrollRef,
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: input.displayName,
        email: input.email,
        staffCode: input.staffCode,
        departmentAssignments: {
          create: departmentIds.map((departmentId, index) => ({
            customerId,
            venueId: input.venueId,
            departmentId,
            isPrimary: index === 0,
          })),
        },
      },
      include: {
        departmentAssignments: {
          where: { isActive: true },
          include: {
            department: { select: { id: true, name: true, revenueCentreType: true } },
          },
        },
      },
    });
  }

  async update(
    customerId: string,
    staffMemberId: string,
    input: UpdateStaffInput,
  ) {
    const staffMember = await this.db.staffMember.findFirst({
      where: { id: staffMemberId, customerId },
    });
    if (!staffMember) {
      throw new NotFoundError("Staff member not found");
    }

    const currentDepartmentAssignments = await this.db.departmentStaffAssignment.findMany({
      where: { staffMemberId, isActive: true },
      select: { departmentId: true },
    });

    const nextVenueId = input.venueId ?? staffMember.venueId;
    const nextDepartmentIds =
      input.departmentIds === undefined
        ? currentDepartmentAssignments.map((assignment) => assignment.departmentId)
        : input.departmentIds;

    if (input.venueId || input.departmentIds !== undefined) {
      await this.validateVenueAndDepartments(customerId, nextVenueId, nextDepartmentIds);
    }

    return this.db.staffMember.update({
      where: { id: staffMemberId },
      data: {
        venueId: input.venueId,
        externalPayrollRef: input.externalPayrollRef,
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: input.displayName,
        email: input.email,
        staffCode: input.staffCode,
        status: input.status,
        ...(input.departmentIds !== undefined || input.venueId
          ? {
              departmentAssignments: {
                deleteMany: {},
                create: nextDepartmentIds.map((departmentId, index) => ({
                  customerId,
                  venueId: nextVenueId,
                  departmentId,
                  isPrimary: index === 0,
                })),
              },
            }
          : {}),
      },
      include: {
        departmentAssignments: {
          where: { isActive: true },
          include: {
            department: { select: { id: true, name: true, revenueCentreType: true } },
          },
        },
      },
    });
  }

  async updateStatus(customerId: string | undefined, staffMemberId: string, status: "ACTIVE" | "INACTIVE") {
    const staffMember = await this.getById(staffMemberId, customerId);

    return this.db.staffMember.update({
      where: { id: staffMember.id },
      data: { status },
    });
  }

  async remove(customerId: string | undefined, staffMemberId: string) {
    const staffMember = await this.db.staffMember.findFirst({
      where: { id: staffMemberId, customerId },
      include: {
        _count: {
          select: {
            poolMemberships: true,
            allocationLines: true,
            allocationResults: true,
            destinationTipTransactions: true,
            auditLogs: true,
          },
        },
      },
    });

    if (!staffMember) {
      throw new NotFoundError("Staff member not found");
    }

    const dependencyCount =
      staffMember._count.poolMemberships +
      staffMember._count.allocationLines +
      staffMember._count.allocationResults +
      staffMember._count.destinationTipTransactions +
      staffMember._count.auditLogs;

    if (dependencyCount > 0) {
      throw new ValidationAppError(
        "This staff member cannot be deleted because they are referenced by pools, allocation rules, or reporting history. Deactivate them instead.",
      );
    }

    await this.db.staffMember.delete({
      where: { id: staffMemberId },
    });

    return { id: staffMemberId, deleted: true as const };
  }

  private async validateVenueAndDepartments(
    customerId: string,
    venueId: string,
    departmentIds: string[],
  ) {
    const venue = await this.db.venue.findFirst({
      where: { id: venueId, customerId },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundError("Venue not found");
    }

    if (departmentIds.length === 0) {
      return;
    }

    const uniqueDepartmentIds = [...new Set(departmentIds)];
    if (uniqueDepartmentIds.length !== departmentIds.length) {
      throw new ValidationAppError("Staff can only be assigned to each department once.");
    }

    const departments = await this.db.department.findMany({
      where: { id: { in: departmentIds }, customerId },
      select: { id: true, venueId: true },
    });

    if (departments.length !== departmentIds.length) {
      throw new NotFoundError("Department not found");
    }

    if (departments.some((department) => department.venueId !== venueId)) {
      throw new ValidationAppError("Staff can only be assigned to departments within the same venue.");
    }
  }
}
