import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "../../../../lib/prisma";
import { NotFoundError, ValidationAppError } from "../../../shared/errors/app-error";
import type { CreateDepartmentInput, UpdateDepartmentInput } from "./departments.schemas";

type ListDepartmentsInput = {
  customerId?: string;
  venueId?: string;
  search?: string;
  page: number;
  pageSize: number;
};

function buildWhere(input: {
  customerId?: string;
  venueId?: string;
  search?: string;
}): Prisma.DepartmentWhereInput {
  return {
    customerId: input.customerId,
    venueId: input.venueId,
    name: input.search
      ? {
          contains: input.search,
          mode: "insensitive",
        }
      : undefined,
  };
}

export class DepartmentsService {
  constructor(
    private readonly db: Pick<PrismaClient, "department" | "venue"> = prisma,
  ) {}

  async list(input: ListDepartmentsInput) {
    const where = buildWhere(input);
    const [items, total] = await Promise.all([
      this.db.department.findMany({
        where,
        include: {
          venue: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              serviceAreas: true,
            },
          },
        },
        orderBy: [{ venue: { name: "asc" } }, { name: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.db.department.count({ where }),
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

  async getById(departmentId: string, customerId?: string) {
    const department = await this.db.department.findFirst({
      where: {
        id: departmentId,
        customerId,
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            serviceAreas: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundError("Department not found");
    }

    return department;
  }

  async create(customerId: string, input: CreateDepartmentInput) {
    const venue = await this.db.venue.findFirst({
      where: { id: input.venueId, customerId },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundError("Venue not found");
    }

    return this.db.department.create({
      data: {
        customerId,
        venueId: input.venueId,
        name: input.name,
        slug: input.slug,
        type: input.type,
        description: input.description,
        isActive: input.isActive,
      },
    });
  }

  async update(customerId: string, departmentId: string, input: UpdateDepartmentInput) {
    const department = await this.db.department.findFirst({
      where: { id: departmentId, customerId },
    });

    if (!department) {
      throw new NotFoundError("Department not found");
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

    return this.db.department.update({
      where: { id: departmentId },
      data: input,
    });
  }

  async remove(customerId: string, departmentId: string) {
    const department = await this.db.department.findFirst({
      where: { id: departmentId, customerId },
      include: {
        _count: {
          select: {
            serviceAreas: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundError("Department not found");
    }

    if (department._count.serviceAreas > 0) {
      throw new ValidationAppError(
        "This department cannot be deleted because it still has service areas. Remove those first.",
      );
    }

    await this.db.department.delete({
      where: { id: departmentId },
    });

    return { id: departmentId, deleted: true as const };
  }
}
