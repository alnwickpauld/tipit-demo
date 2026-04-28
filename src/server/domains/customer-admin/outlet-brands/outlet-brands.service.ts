import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "../../../../lib/prisma";
import { NotFoundError, ValidationAppError } from "../../../shared/errors/app-error";
import type { CreateOutletBrandInput, UpdateOutletBrandInput } from "./outlet-brands.schemas";

type ListOutletBrandsInput = {
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
}): Prisma.OutletBrandWhereInput {
  return {
    customerId: input.customerId,
    venueId: input.venueId,
    OR: input.search
      ? [
          {
            name: {
              contains: input.search,
              mode: "insensitive",
            },
          },
          {
            displayName: {
              contains: input.search,
              mode: "insensitive",
            },
          },
        ]
      : undefined,
  };
}

export class OutletBrandsService {
  constructor(
    private readonly db: Pick<PrismaClient, "outletBrand" | "venue"> = prisma,
  ) {}

  async list(input: ListOutletBrandsInput) {
    const where = buildWhere(input);
    const [items, total] = await Promise.all([
      this.db.outletBrand.findMany({
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
              departments: true,
            },
          },
        },
        orderBy: [{ venue: { name: "asc" } }, { displayName: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.db.outletBrand.count({ where }),
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

  async getById(outletBrandId: string, customerId?: string) {
    const outletBrand = await this.db.outletBrand.findFirst({
      where: {
        id: outletBrandId,
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
            departments: true,
          },
        },
      },
    });

    if (!outletBrand) {
      throw new NotFoundError("Outlet brand not found");
    }

    return outletBrand;
  }

  async create(customerId: string, input: CreateOutletBrandInput) {
    await this.validateVenue(customerId, input.venueId);

    return this.db.outletBrand.create({
      data: {
        customerId,
        venueId: input.venueId,
        name: input.name,
        displayName: input.displayName,
        logoUrl: input.logoUrl ?? null,
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
            departments: true,
          },
        },
      },
    });
  }

  async update(customerId: string, outletBrandId: string, input: UpdateOutletBrandInput) {
    const existing = await this.db.outletBrand.findFirst({
      where: { id: outletBrandId, customerId },
      select: { id: true, venueId: true },
    });

    if (!existing) {
      throw new NotFoundError("Outlet brand not found");
    }

    const venueId = input.venueId ?? existing.venueId;
    if (input.venueId) {
      await this.validateVenue(customerId, venueId);
    }

    return this.db.outletBrand.update({
      where: { id: outletBrandId },
      data: {
        ...input,
        venueId,
        logoUrl: input.logoUrl === undefined ? undefined : input.logoUrl,
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
            departments: true,
          },
        },
      },
    });
  }

  async remove(customerId: string, outletBrandId: string) {
    const outletBrand = await this.db.outletBrand.findFirst({
      where: { id: outletBrandId, customerId },
      include: {
        _count: {
          select: {
            departments: true,
          },
        },
      },
    });

    if (!outletBrand) {
      throw new NotFoundError("Outlet brand not found");
    }

    if (outletBrand._count.departments > 0) {
      throw new ValidationAppError(
        "This outlet brand cannot be deleted because departments still inherit from it.",
      );
    }

    await this.db.outletBrand.delete({
      where: { id: outletBrandId },
    });

    return { id: outletBrandId, deleted: true as const };
  }

  private async validateVenue(customerId: string, venueId: string) {
    const venue = await this.db.venue.findFirst({
      where: { id: venueId, customerId },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundError("Venue not found");
    }
  }
}
