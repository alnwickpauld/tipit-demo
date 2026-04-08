import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { getQrAssetTipUrl } from "../../../../lib/public-tip-links";
import { resolveServiceAreaTippingConfig } from "../../../../lib/public-tip-config";
import { prisma } from "../../../../lib/prisma";
import { NotFoundError, ValidationAppError } from "../../../shared/errors/app-error";
import type { CreateQrAssetInput, UpdateQrAssetInput } from "./qr-assets.schemas";

type ListQrAssetsInput = {
  customerId?: string;
  venueId?: string;
  departmentId?: string;
  destinationType?: "SERVICE_AREA" | "TEAM" | "STAFF_MEMBER";
  isActive?: boolean;
  search?: string;
  page: number;
  pageSize: number;
};

function buildWhere(input: Omit<ListQrAssetsInput, "page" | "pageSize">): Prisma.QrAssetWhereInput {
  return {
    customerId: input.customerId,
    venueId: input.venueId,
    departmentId: input.departmentId,
    destinationType: input.destinationType,
    isActive: input.isActive,
    OR: input.search
      ? [
          { label: { contains: input.search, mode: "insensitive" } },
          { printName: { contains: input.search, mode: "insensitive" } },
          { slug: { contains: input.search, mode: "insensitive" } },
        ]
      : undefined,
  };
}

type QrAssetRecord = Prisma.QrAssetGetPayload<{
  include: {
    venue: { select: { id: true; name: true; slug: true } };
    department: { select: { id: true; name: true; type: true } };
    serviceArea: { select: { id: true; name: true; slug: true; tippingMode: true } };
    staffMember: { select: { id: true; firstName: true; lastName: true; displayName: true } };
  };
}>;

function normalizePreviewConfig(
  value: Prisma.JsonValue | Prisma.InputJsonValue | Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function mapAsset(item: QrAssetRecord) {
  return {
    ...item,
    targetUrl: getQrAssetTipUrl(item.slug),
    printableAsset: {
      slug: item.slug,
      label: item.label,
      printName: item.printName,
      destinationType: item.destinationType,
      displayMode: item.displayMode,
      venue: item.venue,
      department: item.department,
      serviceArea: item.serviceArea,
      staffMember: item.staffMember,
      previewConfig: item.previewConfig ?? {},
    },
  };
}

export class QrAssetsService {
  constructor(
    private readonly db: Pick<
      PrismaClient,
      "qrAsset" | "venue" | "department" | "serviceArea" | "staffMember" | "customerDepartmentTippingSetting"
    > = prisma,
  ) {}

  async list(input: ListQrAssetsInput) {
    const where = buildWhere(input);
    const [items, total] = await Promise.all([
      this.db.qrAsset.findMany({
        where,
        include: {
          venue: { select: { id: true, name: true, slug: true } },
          department: { select: { id: true, name: true, type: true } },
          serviceArea: { select: { id: true, name: true, slug: true, tippingMode: true } },
          staffMember: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        },
        orderBy: [{ venue: { name: "asc" } }, { department: { name: "asc" } }, { printName: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.db.qrAsset.count({ where }),
    ]);

    return {
      items: items.map(mapAsset),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      },
    };
  }

  async getById(qrAssetId: string, customerId?: string) {
    const qrAsset = await this.db.qrAsset.findFirst({
      where: {
        id: qrAssetId,
        customerId,
      },
      include: {
        venue: { select: { id: true, name: true, slug: true } },
        department: { select: { id: true, name: true, type: true } },
        serviceArea: { select: { id: true, name: true, slug: true, tippingMode: true } },
        staffMember: { select: { id: true, firstName: true, lastName: true, displayName: true } },
      },
    });

    if (!qrAsset) {
      throw new NotFoundError("QR asset not found");
    }

    return mapAsset(qrAsset);
  }

  async create(customerId: string, input: CreateQrAssetInput) {
    const validated = await this.validateRelationships(customerId, input);

    const created = await this.db.qrAsset.create({
      data: {
        customerId,
        venueId: validated.venue.id,
        departmentId: validated.department?.id,
        serviceAreaId: validated.serviceArea?.id,
        staffMemberId: validated.staffMember?.id,
        slug: input.slug,
        destinationType: input.destinationType,
        label: input.label,
        printName: input.printName,
        displayMode: input.displayMode,
        isActive: input.isActive,
        previewConfig: input.previewConfig as Prisma.InputJsonValue | undefined,
      },
      select: {
        id: true,
      },
    });

    return this.getById(created.id, customerId);
  }

  async update(customerId: string, qrAssetId: string, input: UpdateQrAssetInput) {
    const existing = await this.db.qrAsset.findFirst({
      where: { id: qrAssetId, customerId },
    });

    if (!existing) {
      throw new NotFoundError("QR asset not found");
    }

    const merged = {
      customerId,
      venueId: input.venueId ?? existing.venueId,
      departmentId: input.departmentId ?? existing.departmentId ?? undefined,
      serviceAreaId: input.serviceAreaId ?? existing.serviceAreaId ?? undefined,
      staffMemberId: input.staffMemberId ?? existing.staffMemberId ?? undefined,
      destinationType: input.destinationType ?? existing.destinationType,
      label: input.label ?? existing.label,
      printName: input.printName ?? existing.printName,
      displayMode: input.displayMode ?? existing.displayMode,
      slug: input.slug ?? existing.slug,
      isActive: input.isActive ?? existing.isActive,
      previewConfig: input.previewConfig ?? normalizePreviewConfig(existing.previewConfig),
    } satisfies CreateQrAssetInput;

    const validated = await this.validateRelationships(customerId, merged);

    await this.db.qrAsset.update({
      where: { id: qrAssetId },
      data: {
        venueId: validated.venue.id,
        departmentId: validated.department?.id ?? null,
        serviceAreaId: validated.serviceArea?.id ?? null,
        staffMemberId: validated.staffMember?.id ?? null,
        destinationType: merged.destinationType,
        label: merged.label,
        printName: merged.printName,
        displayMode: merged.displayMode,
        slug: merged.slug,
        isActive: merged.isActive,
        previewConfig: merged.previewConfig as Prisma.InputJsonValue | undefined,
      },
      select: {
        id: true,
      },
    });

    return this.getById(qrAssetId, customerId);
  }

  async remove(customerId: string, qrAssetId: string) {
    const qrAsset = await this.db.qrAsset.findFirst({
      where: { id: qrAssetId, customerId },
      select: { id: true },
    });

    if (!qrAsset) {
      throw new NotFoundError("QR asset not found");
    }

    await this.db.qrAsset.delete({ where: { id: qrAssetId } });
    return { id: qrAssetId, deleted: true as const };
  }

  private async validateRelationships(customerId: string, input: CreateQrAssetInput) {
    const [venue, department, serviceArea, staffMember] = await Promise.all([
      this.db.venue.findFirst({
        where: { id: input.venueId, customerId },
        select: { id: true, name: true },
      }),
      input.departmentId
        ? this.db.department.findFirst({
            where: { id: input.departmentId, customerId },
            select: { id: true, venueId: true, type: true, name: true },
          })
        : Promise.resolve(null),
      input.serviceAreaId
        ? this.db.serviceArea.findFirst({
            where: { id: input.serviceAreaId, customerId },
            select: {
              id: true,
              venueId: true,
              departmentId: true,
              tippingMode: true,
              teamTippingEnabled: true,
              individualTippingEnabled: true,
              department: {
                select: {
                  type: true,
                  name: true,
                },
              },
            },
          })
        : Promise.resolve(null),
      input.staffMemberId
        ? this.db.staffMember.findFirst({
            where: { id: input.staffMemberId, customerId },
            select: { id: true, venueId: true, status: true },
          })
        : Promise.resolve(null),
    ]);

    if (!venue) {
      throw new NotFoundError("Venue not found");
    }

    if (department && department.venueId !== venue.id) {
      throw new ValidationAppError("QR asset department must belong to the selected venue.");
    }

    if (serviceArea) {
      if (serviceArea.venueId !== venue.id) {
        throw new ValidationAppError("QR asset service area must belong to the selected venue.");
      }

      if (department && serviceArea.departmentId !== department.id) {
        throw new ValidationAppError("QR asset service area must belong to the selected department.");
      }
    }

    if (staffMember) {
      if (staffMember.venueId !== venue.id) {
        throw new ValidationAppError("QR asset staff member must belong to the selected venue.");
      }

      if (staffMember.status !== "ACTIVE") {
        throw new ValidationAppError("QR assets can only target active staff members.");
      }
    }

    if (input.destinationType === "SERVICE_AREA" || input.destinationType === "TEAM") {
      if (!serviceArea) {
        throw new ValidationAppError("Service-area and team QR assets must be linked to a service area.");
      }
    }

    if (input.destinationType === "STAFF_MEMBER" && !staffMember) {
      throw new ValidationAppError("Staff QR assets must be linked to an individual staff member.");
    }

    if (input.destinationType !== "STAFF_MEMBER" && input.staffMemberId) {
      throw new ValidationAppError("Only staff QR assets can include a staff member target.");
    }

    if (input.destinationType === "TEAM" && serviceArea && !serviceArea.teamTippingEnabled) {
      throw new ValidationAppError("This service area does not currently allow whole-team tipping.");
    }

    if (input.destinationType === "STAFF_MEMBER") {
      if (!department && serviceArea) {
        throw new ValidationAppError("Staff QR assets linked to a service area must include its department.");
      }

      if (department) {
        const departmentConfig = await this.db.customerDepartmentTippingSetting.findUnique({
          where: {
            customerId_departmentType: {
              customerId,
              departmentType: department.type,
            },
          },
          select: {
            qrTippingEnabled: true,
            teamTippingEnabled: true,
            individualTippingEnabled: true,
            shiftSelectorEnabled: true,
          },
        });

        const resolved = resolveServiceAreaTippingConfig(
          departmentConfig ?? {
            qrTippingEnabled: false,
            teamTippingEnabled: false,
            individualTippingEnabled: false,
            shiftSelectorEnabled: false,
          },
          {
            tippingMode: serviceArea?.tippingMode ?? "INDIVIDUAL_ONLY",
            teamTippingEnabled: serviceArea?.teamTippingEnabled ?? false,
            individualTippingEnabled: serviceArea?.individualTippingEnabled ?? true,
          },
        );

        if (!resolved.enabled || !resolved.individualAllowed) {
          throw new ValidationAppError(
            "Individual staff QR assets are only allowed where individual tipping is explicitly enabled.",
          );
        }
      }
    }

    return {
      venue,
      department,
      serviceArea,
      staffMember,
    };
  }
}
