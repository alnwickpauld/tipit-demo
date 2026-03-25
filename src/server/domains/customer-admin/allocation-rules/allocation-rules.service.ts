import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { prisma } from "../../../../lib/prisma";
import { NotFoundError, ValidationAppError } from "../../../shared/errors/app-error";

type AllocationRuleInput = {
  venueId: string;
  name: string;
  description?: string;
  priority: number;
  isActive: boolean;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  lines: Array<{
    recipientType: "STAFF" | "POOL";
    staffMemberId?: string;
    poolId?: string;
    percentageBps: number;
    sortOrder: number;
  }>;
};

function validatePercentageTotal(lines: AllocationRuleInput["lines"]) {
  const total = lines.reduce((sum, line) => sum + line.percentageBps, 0);
  if (total !== 10_000) {
    throw new ValidationAppError("Allocation rule lines must total 10000 basis points");
  }
}

function buildRuleUpdateData(
  input: Partial<AllocationRuleInput>,
): Prisma.AllocationRuleUncheckedUpdateInput {
  return {
    name: input.name,
    description: input.description,
    priority: input.priority,
    isActive: input.isActive,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
  };
}

export class AllocationRulesService {
  constructor(
    private readonly db: Pick<
      PrismaClient,
      "allocationRule" | "allocationRuleLine" | "venue" | "staffMember" | "pool"
    > = prisma,
  ) {}

  async list(customerId: string) {
    return this.db.allocationRule.findMany({
      where: { venue: { customerId } },
      orderBy: [{ venue: { name: "asc" } }, { priority: "asc" }],
      include: {
        venue: { select: { id: true, name: true } },
        lines: {
          include: {
            staffMember: { select: { id: true, firstName: true, lastName: true, displayName: true } },
            pool: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async create(customerId: string, input: AllocationRuleInput) {
    validatePercentageTotal(input.lines);
    await this.assertReferences(customerId, input.venueId, input.lines);

    return this.db.allocationRule.create({
      data: {
        venueId: input.venueId,
        name: input.name,
        description: input.description,
        priority: input.priority,
        isActive: input.isActive,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        lines: {
          create: input.lines,
        },
      },
      include: { lines: true },
    });
  }

  async update(customerId: string, ruleId: string, input: Partial<AllocationRuleInput>) {
    const existing = await this.db.allocationRule.findFirst({
      where: { id: ruleId, venue: { customerId } },
    });
    if (!existing) {
      throw new NotFoundError("Allocation rule not found");
    }

    const venueId = input.venueId ?? existing.venueId;
    if (input.lines) {
      validatePercentageTotal(input.lines);
      await this.assertReferences(customerId, venueId, input.lines);
    }

    if (!input.lines) {
      return this.db.allocationRule.update({
        where: { id: ruleId },
        data: buildRuleUpdateData(input),
        include: { lines: true },
      });
    }

    await this.db.allocationRuleLine.deleteMany({ where: { allocationRuleId: ruleId } });
    const { lines } = input;

    return this.db.allocationRule.update({
      where: { id: ruleId },
      data: {
        ...buildRuleUpdateData(input),
        lines: {
          create: lines,
        },
      },
      include: { lines: true },
    });
  }

  private async assertReferences(
    customerId: string,
    venueId: string,
    lines: AllocationRuleInput["lines"],
  ) {
    const venue = await this.db.venue.findFirst({
      where: { id: venueId, customerId },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundError("Venue not found");
    }

    const staffIds = lines.flatMap((line) =>
      line.recipientType === "STAFF" && line.staffMemberId ? [line.staffMemberId] : [],
    );
    const poolIds = lines.flatMap((line) =>
      line.recipientType === "POOL" && line.poolId ? [line.poolId] : [],
    );

    if (staffIds.length > 0) {
      const count = await this.db.staffMember.count({
        where: { customerId, id: { in: staffIds } },
      });

      if (count !== staffIds.length) {
        throw new NotFoundError("One or more staff recipients were not found");
      }
    }

    if (poolIds.length > 0) {
      const count = await this.db.pool.count({
        where: { customerId, id: { in: poolIds } },
      });

      if (count !== poolIds.length) {
        throw new NotFoundError("One or more pool recipients were not found");
      }
    }
  }
}
