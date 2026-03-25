import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "../../../../lib/prisma";
import { NotFoundError, ValidationAppError } from "../../../shared/errors/app-error";
import type { CreateStaffInput, UpdateStaffInput } from "./staff.schemas";

type ListStaffInput = {
  customerId?: string;
  venueId?: string;
};

function buildWhere(input: ListStaffInput): Prisma.StaffMemberWhereInput {
  return {
    customerId: input.customerId,
    venueId: input.venueId,
  };
}

export class StaffService {
  constructor(
    private readonly db: Pick<PrismaClient, "staffMember" | "venue"> = prisma,
  ) {}

  async list(input: ListStaffInput) {
    return this.db.staffMember.findMany({
      where: buildWhere(input),
      orderBy: [{ venue: { name: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
      include: {
        venue: { select: { id: true, name: true } },
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
      },
    });

    if (!staffMember) {
      throw new NotFoundError("Staff member not found");
    }

    return staffMember;
  }

  async create(customerId: string, input: CreateStaffInput) {
    const venue = await this.db.venue.findFirst({
      where: { id: input.venueId, customerId },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundError("Venue not found");
    }

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

    if (input.venueId) {
      const venue = await this.db.venue.findFirst({
        where: { id: input.venueId, customerId },
        select: { id: true },
      });

      if (!venue) {
        throw new NotFoundError("Venue not found");
      }
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
}
