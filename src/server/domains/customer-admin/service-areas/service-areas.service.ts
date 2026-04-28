import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "../../../../lib/prisma";
import { NotFoundError, ValidationAppError } from "../../../shared/errors/app-error";
import type { CreateServiceAreaInput, UpdateServiceAreaInput } from "./service-areas.schemas";

type ListServiceAreasInput = {
  customerId?: string;
  venueId?: string;
  departmentId?: string;
  search?: string;
  page: number;
  pageSize: number;
};

function buildWhere(input: {
  customerId?: string;
  venueId?: string;
  departmentId?: string;
  search?: string;
}): Prisma.ServiceAreaWhereInput {
  return {
    customerId: input.customerId,
    venueId: input.venueId,
    departmentId: input.departmentId,
    name: input.search
      ? {
          contains: input.search,
          mode: "insensitive",
        }
      : undefined,
  };
}

export class ServiceAreasService {
  constructor(
    private readonly db: Pick<
      PrismaClient,
      "serviceArea" | "venue" | "department"
    > = prisma,
  ) {}

  async list(input: ListServiceAreasInput) {
    const where = buildWhere(input);
    const [items, total] = await Promise.all([
      this.db.serviceArea.findMany({
        where,
        include: {
          venue: {
            select: {
              id: true,
              name: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              revenueCentreType: true,
              outletBrand: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  logoUrl: true,
                },
              },
            },
          },
        },
        orderBy: [{ venue: { name: "asc" } }, { department: { name: "asc" } }, { name: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.db.serviceArea.count({ where }),
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

  async getById(serviceAreaId: string, customerId?: string) {
    const serviceArea = await this.db.serviceArea.findFirst({
      where: {
        id: serviceAreaId,
        customerId,
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            revenueCentreType: true,
            outletBrand: {
              select: {
                id: true,
                name: true,
                displayName: true,
                logoUrl: true,
              },
            },
          },
        },
      },
    });

    if (!serviceArea) {
      throw new NotFoundError("Service area not found");
    }

    return serviceArea;
  }

  async create(customerId: string, input: CreateServiceAreaInput) {
    await this.validateLinks(customerId, input.venueId, input.departmentId);

    return this.db.serviceArea.create({
      data: {
        customerId,
        venueId: input.venueId,
        departmentId: input.departmentId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        tipScreenBackgroundColor: input.tipScreenBackgroundColor,
        tipScreenTextColor: input.tipScreenTextColor,
        tipScreenButtonColor: input.tipScreenButtonColor,
        tipScreenButtonTextColor: input.tipScreenButtonTextColor,
        tipScreenLogoImageUrl: input.tipScreenLogoImageUrl || undefined,
        tippingMode: input.tippingMode,
        displayMode: input.displayMode,
        noActiveShiftBehavior: input.noActiveShiftBehavior,
        isActive: input.isActive,
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            revenueCentreType: true,
            outletBrand: {
              select: {
                id: true,
                name: true,
                displayName: true,
                logoUrl: true,
              },
            },
          },
        },
      },
    });
  }

  async update(customerId: string, serviceAreaId: string, input: UpdateServiceAreaInput) {
    const serviceArea = await this.db.serviceArea.findFirst({
      where: { id: serviceAreaId, customerId },
    });

    if (!serviceArea) {
      throw new NotFoundError("Service area not found");
    }

    const venueId = input.venueId ?? serviceArea.venueId;
    const departmentId = input.departmentId ?? serviceArea.departmentId;

    if (input.venueId || input.departmentId) {
      await this.validateLinks(customerId, venueId, departmentId);
    }

    return this.db.serviceArea.update({
      where: { id: serviceAreaId },
      data: input,
      include: {
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            revenueCentreType: true,
            outletBrand: {
              select: {
                id: true,
                name: true,
                displayName: true,
                logoUrl: true,
              },
            },
          },
        },
      },
    });
  }

  async remove(customerId: string, serviceAreaId: string) {
    const serviceArea = await this.db.serviceArea.findFirst({
      where: { id: serviceAreaId, customerId },
      include: {
        _count: {
          select: {
            destinationTipTransactions: true,
          },
        },
      },
    });

    if (!serviceArea) {
      throw new NotFoundError("Service area not found");
    }

    if (serviceArea._count.destinationTipTransactions > 0) {
      throw new ValidationAppError(
        "This service area cannot be deleted because it already has tip history. Deactivate or rename it instead.",
      );
    }

    await this.db.serviceArea.delete({
      where: { id: serviceAreaId },
    });

    return { id: serviceAreaId, deleted: true as const };
  }

  private async validateLinks(customerId: string, venueId: string, departmentId: string) {
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
      throw new ValidationAppError(
        "Service areas must belong to a department within the same venue.",
      );
    }
  }
}
