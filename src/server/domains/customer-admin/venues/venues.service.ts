import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "../../../../lib/prisma";
import { NotFoundError, ValidationAppError } from "../../../shared/errors/app-error";

type CreateVenueInput = {
  customerId?: string;
  name: string;
  slug: string;
  code?: string;
  type?:
    | "HOTEL_BAR"
    | "RESTAURANT"
    | "CAFE"
    | "HOSPITALITY_SUITE"
    | "EVENT_SPACE"
    | "OTHER";
  address?: string;
  timezone?: string;
  description?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  country?: string;
  brandBackgroundColor?: string;
  brandTextColor?: string;
  brandButtonColor?: string;
  brandButtonTextColor?: string;
  brandLogoImageUrl?: string | null;
};

type UpdateVenueInput = Partial<CreateVenueInput & { status: "ACTIVE" | "INACTIVE" }>;
type ListVenuesInput = {
  customerId?: string;
  search?: string;
  page: number;
  pageSize: number;
};

function buildWhere(input: { customerId?: string; search?: string }): Prisma.VenueWhereInput {
  return {
    customerId: input.customerId,
    name: input.search
      ? {
          contains: input.search,
          mode: "insensitive",
        }
      : undefined,
  };
}

export class VenuesService {
  constructor(private readonly db: Pick<PrismaClient, "venue"> = prisma) {}

  async list(input: ListVenuesInput) {
    const where = buildWhere(input);
    const [items, total] = await Promise.all([
      this.db.venue.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.db.venue.count({ where }),
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

  async getById(venueId: string, customerId?: string) {
    const venue = await this.db.venue.findFirst({
      where: {
        id: venueId,
        customerId,
      },
    });

    if (!venue) {
      throw new NotFoundError("Venue not found");
    }

    return venue;
  }

  async create(customerId: string, input: CreateVenueInput) {
    return this.db.venue.create({
      data: {
        customerId,
        name: input.name,
        slug: input.slug,
        code: input.code,
        type: input.type,
        address: input.address,
        timezone: input.timezone,
        description: input.description,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        postcode: input.postcode,
        country: input.country,
        brandBackgroundColor: input.brandBackgroundColor,
        brandTextColor: input.brandTextColor,
        brandButtonColor: input.brandButtonColor,
        brandButtonTextColor: input.brandButtonTextColor,
        brandLogoImageUrl: input.brandLogoImageUrl,
      },
    });
  }

  async update(
    customerId: string | undefined,
    venueId: string,
    input: UpdateVenueInput,
  ) {
    const venue = await this.db.venue.findFirst({
      where: { id: venueId, customerId },
    });
    if (!venue) {
      throw new NotFoundError("Venue not found");
    }

    return this.db.venue.update({
      where: { id: venueId },
      data: input,
    });
  }

  async updateStatus(customerId: string | undefined, venueId: string, status: "ACTIVE" | "INACTIVE") {
    return this.update(customerId, venueId, { status });
  }

  async remove(customerId: string | undefined, venueId: string) {
    const venue = await this.db.venue.findFirst({
      where: { id: venueId, customerId },
      include: {
        _count: {
          select: {
            staffMembers: true,
            departments: true,
            serviceAreas: true,
            pools: true,
            allocationRules: true,
            tipTransactions: true,
            destinationTipTransactions: true,
            allocationResults: true,
            auditLogs: true,
          },
        },
      },
    });

    if (!venue) {
      throw new NotFoundError("Venue not found");
    }

    const dependencyCount =
      venue._count.staffMembers +
      venue._count.departments +
      venue._count.serviceAreas +
      venue._count.pools +
      venue._count.allocationRules +
      venue._count.tipTransactions +
      venue._count.destinationTipTransactions +
      venue._count.allocationResults +
      venue._count.auditLogs;

    if (dependencyCount > 0) {
      throw new ValidationAppError(
        "This venue cannot be deleted because it already has linked staff, pools, rules, or reporting history. Deactivate it instead.",
      );
    }

    await this.db.venue.delete({
      where: { id: venueId },
    });

    return { id: venueId, deleted: true as const };
  }
}
