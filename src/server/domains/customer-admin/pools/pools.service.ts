import type { PrismaClient } from "@prisma/client";

import { prisma } from "../../../../lib/prisma";
import { NotFoundError, ValidationAppError } from "../../../shared/errors/app-error";

type CreatePoolInput = {
  venueId: string;
  name: string;
  slug: string;
  description?: string;
  memberStaffIds: string[];
};

export class PoolsService {
  constructor(
    private readonly db: Pick<PrismaClient, "pool" | "poolMember" | "staffMember" | "venue"> = prisma,
  ) {}

  async list(customerId: string) {
    return this.db.pool.findMany({
      where: { customerId },
      orderBy: [{ venue: { name: "asc" } }, { name: "asc" }],
      include: {
        venue: { select: { id: true, name: true } },
        members: {
          include: {
            staffMember: { select: { id: true, firstName: true, lastName: true, displayName: true } },
          },
        },
      },
    });
  }

  async create(customerId: string, input: CreatePoolInput) {
    const venue = await this.db.venue.findFirst({
      where: { id: input.venueId, customerId },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundError("Venue not found");
    }

    await this.validateMembers(customerId, input.venueId, input.memberStaffIds);

    return this.db.pool.create({
      data: {
        customerId,
        venueId: input.venueId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        members: {
          create: input.memberStaffIds.map((staffMemberId) => ({
            staffMemberId,
          })),
        },
      },
      include: {
        members: true,
      },
    });
  }

  async update(
    customerId: string,
    poolId: string,
    input: Partial<CreatePoolInput & { status: "ACTIVE" | "INACTIVE" }>,
  ) {
    const pool = await this.db.pool.findFirst({ where: { id: poolId, customerId } });
    if (!pool) {
      throw new NotFoundError("Pool not found");
    }

    const { memberStaffIds, ...poolData } = input;

    if (poolData.venueId) {
      const venue = await this.db.venue.findFirst({
        where: { id: poolData.venueId, customerId },
        select: { id: true },
      });

      if (!venue) {
        throw new NotFoundError("Venue not found");
      }
    }

    const venueId = poolData.venueId ?? pool.venueId;

    if (memberStaffIds) {
      await this.validateMembers(customerId, venueId, memberStaffIds);
    }

    if (!memberStaffIds) {
      return this.db.pool.update({
        where: { id: poolId },
        data: poolData,
      });
    }

    await this.db.poolMember.deleteMany({ where: { poolId } });

    return this.db.pool.update({
      where: { id: poolId },
      data: {
        ...poolData,
        members: {
          create: memberStaffIds.map((staffMemberId) => ({
            staffMemberId,
          })),
        },
      },
      include: {
        members: true,
      },
    });
  }

  async remove(customerId: string, poolId: string) {
    const pool = await this.db.pool.findFirst({
      where: { id: poolId, customerId },
      include: {
        _count: {
          select: {
            members: true,
            allocationLines: true,
            allocationResults: true,
            destinationTipTransactions: true,
            auditLogs: true,
          },
        },
      },
    });

    if (!pool) {
      throw new NotFoundError("Pool not found");
    }

    const dependencyCount =
      pool._count.members +
      pool._count.allocationLines +
      pool._count.allocationResults +
      pool._count.destinationTipTransactions +
      pool._count.auditLogs;

    if (dependencyCount > 0) {
      throw new ValidationAppError(
        "This pool cannot be deleted because it already has members, allocation rules, or reporting history. Remove members and deactivate it instead.",
      );
    }

    await this.db.pool.delete({
      where: { id: poolId },
    });

    return { id: poolId, deleted: true as const };
  }

  private async validateMembers(customerId: string, venueId: string, memberStaffIds: string[]) {
    if (memberStaffIds.length === 0) {
      return;
    }

    const uniqueIds = [...new Set(memberStaffIds)];
    if (uniqueIds.length !== memberStaffIds.length) {
      throw new ValidationAppError("Staff members can only be added to a pool once");
    }

    const matchingMembers = await this.db.staffMember.findMany({
      where: {
        customerId,
        venueId,
        id: { in: memberStaffIds },
      },
      select: { id: true },
    });

    if (matchingMembers.length !== memberStaffIds.length) {
      throw new ValidationAppError(
        "All pool members must belong to the same customer and venue as the pool",
      );
    }
  }
}
