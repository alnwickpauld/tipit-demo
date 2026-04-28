import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { prisma } from "../../../../lib/prisma";
import { NotFoundError, ValidationAppError } from "../../../shared/errors/app-error";

type AllocationRuleInput = {
  venueId: string;
  departmentId?: string;
  serviceAreaId?: string;
  templateId?: string;
  scope: "VENUE_DEFAULT" | "DEPARTMENT" | "SERVICE_AREA";
  selectionType?: "TEAM" | "INDIVIDUAL";
  name: string;
  description?: string;
  priority: number;
  isActive: boolean;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  lines: Array<{
    recipientType: "STAFF" | "POOL" | "SELECTED_STAFF";
    staffMemberId?: string;
    poolId?: string;
    percentageBps: number;
    sortOrder: number;
  }>;
};

type CreateFromTemplateInput = {
  templateId: string;
  venueId: string;
  departmentId?: string;
  serviceAreaId?: string;
  scope?: "VENUE_DEFAULT" | "DEPARTMENT" | "SERVICE_AREA";
  selectionType?: "TEAM" | "INDIVIDUAL";
  name?: string;
  description?: string;
  priority?: number;
  isActive?: boolean;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  lineRecipients: Array<{
    sortOrder: number;
    staffMemberId?: string;
    poolId?: string;
  }>;
};

function validatePercentageTotal(lines: AllocationRuleInput["lines"]) {
  const total = lines.reduce((sum, line) => sum + line.percentageBps, 0);
  if (total !== 10_000) {
    throw new ValidationAppError("Allocation rule lines must total 10000 basis points");
  }
}

function normalizeRuleLines(
  lines: Array<{
    recipientType: "STAFF" | "POOL" | "SELECTED_STAFF";
    staffMemberId?: string | null;
    poolId?: string | null;
    percentageBps: number;
    sortOrder: number;
  }>,
): AllocationRuleInput["lines"] {
  return lines.map((line) => ({
    recipientType: line.recipientType,
    staffMemberId: line.staffMemberId ?? undefined,
    poolId: line.poolId ?? undefined,
    percentageBps: line.percentageBps,
    sortOrder: line.sortOrder,
  }));
}

function buildRuleUpdateData(
  input: Partial<AllocationRuleInput>,
): Prisma.AllocationRuleUncheckedUpdateInput {
  return {
    templateId: input.templateId,
    departmentId: input.departmentId,
    serviceAreaId: input.serviceAreaId,
    scope: input.scope,
    selectionType: input.selectionType,
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
      | "allocationRule"
      | "allocationRuleLine"
      | "allocationRuleTemplate"
      | "venue"
      | "staffMember"
      | "pool"
      | "department"
      | "serviceArea"
    > = prisma,
  ) {}

  async list(customerId: string) {
    return this.db.allocationRule.findMany({
      where: { venue: { customerId } },
      orderBy: [{ venue: { name: "asc" } }, { priority: "asc" }],
      include: {
        venue: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, revenueCentreType: true } },
        serviceArea: { select: { id: true, name: true, slug: true } },
        lines: {
          include: {
            staffMember: { select: { id: true, firstName: true, lastName: true, displayName: true } },
            pool: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async listTemplates(filters?: {
    recommendedOnly?: boolean;
    scope?: "VENUE_DEFAULT" | "DEPARTMENT" | "SERVICE_AREA";
    selectionType?: "TEAM" | "INDIVIDUAL";
  }) {
    return this.db.allocationRuleTemplate.findMany({
      where: {
        isActive: true,
        ...(filters?.recommendedOnly ? { isRecommended: true } : {}),
        ...(filters?.scope ? { scope: filters.scope } : {}),
        ...(filters?.selectionType ? { selectionType: filters.selectionType } : {}),
      },
      orderBy: [{ isRecommended: "desc" }, { name: "asc" }],
      include: {
        lines: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  }

  async create(customerId: string, input: AllocationRuleInput) {
    validatePercentageTotal(input.lines);
    await this.assertReferences(customerId, input);

    return this.db.allocationRule.create({
      data: {
        venueId: input.venueId,
        departmentId: input.departmentId,
        serviceAreaId: input.serviceAreaId,
        templateId: input.templateId,
        scope: input.scope,
        selectionType: input.selectionType,
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
      include: { lines: true, department: true, serviceArea: true },
    });
  }

  async createFromTemplate(customerId: string, input: CreateFromTemplateInput) {
    const template = await this.db.allocationRuleTemplate.findFirst({
      where: {
        id: input.templateId,
        isActive: true,
      },
      include: {
        lines: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!template) {
      throw new NotFoundError("Allocation rule template not found");
    }

    const bindingBySortOrder = new Map(
      input.lineRecipients.map((binding) => [binding.sortOrder, binding]),
    );

    const lines = template.lines.map((line) => {
      const binding = bindingBySortOrder.get(line.sortOrder);

      if (line.recipientType === "POOL" && !binding?.poolId) {
        throw new ValidationAppError(
          `Template line ${line.sortOrder} requires a target pool before the rule can be created`,
        );
      }

      if (line.recipientType === "STAFF" && !binding?.staffMemberId) {
        throw new ValidationAppError(
          `Template line ${line.sortOrder} requires a target staff member before the rule can be created`,
        );
      }

      return {
        recipientType: line.recipientType,
        staffMemberId: binding?.staffMemberId,
        poolId: binding?.poolId,
        percentageBps: line.percentageBps,
        sortOrder: line.sortOrder,
      };
    });

    return this.create(customerId, {
      templateId: template.id,
      venueId: input.venueId,
      departmentId: input.departmentId,
      serviceAreaId: input.serviceAreaId,
      scope: input.scope ?? template.scope,
      selectionType: input.selectionType ?? template.selectionType ?? undefined,
      name: input.name ?? template.name,
      description: input.description ?? template.description ?? undefined,
      priority: input.priority ?? template.priority,
      isActive: input.isActive ?? true,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      lines,
    });
  }

  async update(customerId: string, ruleId: string, input: Partial<AllocationRuleInput>) {
    const existing = await this.db.allocationRule.findFirst({
      where: { id: ruleId, venue: { customerId } },
      include: {
        lines: true,
      },
    });
    if (!existing) {
      throw new NotFoundError("Allocation rule not found");
    }

    const venueId = input.venueId ?? existing.venueId;
    const mergedInput: AllocationRuleInput = {
      venueId,
      departmentId: input.departmentId ?? existing.departmentId ?? undefined,
      serviceAreaId: input.serviceAreaId ?? existing.serviceAreaId ?? undefined,
      scope: input.scope ?? existing.scope,
      selectionType: input.selectionType ?? existing.selectionType ?? undefined,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description ?? undefined,
      priority: input.priority ?? existing.priority,
      isActive: input.isActive ?? existing.isActive,
      effectiveFrom: input.effectiveFrom ?? existing.effectiveFrom ?? undefined,
      effectiveTo: input.effectiveTo ?? existing.effectiveTo ?? undefined,
      lines: input.lines ?? [],
    };

    if (input.lines) {
      validatePercentageTotal(input.lines);
    }
    await this.assertReferences(customerId, {
      ...mergedInput,
      lines: input.lines ?? normalizeRuleLines(existing.lines),
    });

    if (!input.lines) {
      return this.db.allocationRule.update({
        where: { id: ruleId },
        data: buildRuleUpdateData(input),
        include: { lines: true, department: true, serviceArea: true },
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
      include: { lines: true, department: true, serviceArea: true },
    });
  }

  private async assertReferences(customerId: string, input: AllocationRuleInput) {
    const venue = await this.db.venue.findFirst({
      where: { id: input.venueId, customerId },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundError("Venue not found");
    }

    const lines = input.lines;

    if (input.scope === "DEPARTMENT" && !input.departmentId) {
      throw new ValidationAppError("Department-scoped rules must specify a department.");
    }

    if (input.scope === "SERVICE_AREA" && !input.serviceAreaId) {
      throw new ValidationAppError("Service-area-scoped rules must specify a service area.");
    }

    if (input.scope === "VENUE_DEFAULT" && (input.departmentId || input.serviceAreaId)) {
      throw new ValidationAppError("Venue-default rules cannot target a department or service area.");
    }

    const [department, serviceArea] = await Promise.all([
      input.departmentId
        ? this.db.department.findFirst({
            where: { id: input.departmentId, customerId },
            select: { id: true, venueId: true },
          })
        : Promise.resolve(null),
      input.serviceAreaId
        ? this.db.serviceArea.findFirst({
            where: { id: input.serviceAreaId, customerId },
            select: { id: true, venueId: true, departmentId: true },
          })
        : Promise.resolve(null),
    ]);

    if (input.departmentId && !department) {
      throw new NotFoundError("Department not found");
    }

    if (department && department.venueId !== input.venueId) {
      throw new ValidationAppError("Allocation rule department must belong to the selected venue.");
    }

    if (input.serviceAreaId && !serviceArea) {
      throw new NotFoundError("Service area not found");
    }

    if (serviceArea && serviceArea.venueId !== input.venueId) {
      throw new ValidationAppError("Allocation rule service area must belong to the selected venue.");
    }

    if (department && serviceArea && serviceArea.departmentId !== department.id) {
      throw new ValidationAppError("Allocation rule service area must belong to the selected department.");
    }

    if (lines.some((line) => line.recipientType === "SELECTED_STAFF") && input.selectionType !== "INDIVIDUAL") {
      throw new ValidationAppError("SELECTED_STAFF lines are only valid on INDIVIDUAL allocation rules.");
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

    for (const line of lines) {
      if (line.recipientType === "STAFF" && !line.staffMemberId) {
        throw new ValidationAppError("STAFF allocation lines must specify a staff member.");
      }

      if (line.recipientType === "POOL" && !line.poolId) {
        throw new ValidationAppError("POOL allocation lines must specify a pool.");
      }

      if (line.recipientType === "SELECTED_STAFF" && (line.staffMemberId || line.poolId)) {
        throw new ValidationAppError("SELECTED_STAFF lines cannot include fixed recipient IDs.");
      }
    }
  }
}
