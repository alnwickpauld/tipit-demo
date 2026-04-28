import { prisma } from "../../../../lib/prisma";
import type { RevenueCentreType } from "../../../../lib/revenue-centres";
import { NotFoundError } from "../../../shared/errors/app-error";

const REVENUE_CENTRE_TYPES = [
  "RESTAURANT",
  "BAR",
  "MEETINGS_EVENTS",
  "BREAKFAST",
  "ROOM_SERVICE",
] as const;

export class TippingSettingsService {
  async get(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        departmentTippingSettings: {
          orderBy: {
            revenueCentreType: "asc",
          },
        },
        serviceAreas: {
          orderBy: [{ venue: { name: "asc" } }, { department: { name: "asc" } }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            tippingMode: true,
            teamTippingEnabled: true,
            individualTippingEnabled: true,
            isActive: true,
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
        },
      },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const departmentTippingSettings = REVENUE_CENTRE_TYPES.map((revenueCentreType) => {
      const existing = customer.departmentTippingSettings.find(
        (setting) => setting.revenueCentreType === revenueCentreType,
      );

      return (
        existing ?? {
          id: `default-${customer.id}-${revenueCentreType}`,
          customerId: customer.id,
          revenueCentreType,
          qrTippingEnabled: false,
          teamTippingEnabled: true,
          individualTippingEnabled: false,
          shiftSelectorEnabled: false,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
        }
      );
    });

    return {
      ...customer,
      departmentTippingSettings,
    };
  }

  async updateDepartmentSetting(
    customerId: string,
    revenueCentreType: RevenueCentreType,
    input: Partial<{
      qrTippingEnabled: boolean;
      teamTippingEnabled: boolean;
      individualTippingEnabled: boolean;
      shiftSelectorEnabled: boolean;
    }>,
  ) {
    return prisma.customerDepartmentTippingSetting.upsert({
      where: {
        customerId_revenueCentreType: {
          customerId,
          revenueCentreType,
        },
      },
      create: {
        customerId,
        revenueCentreType,
        qrTippingEnabled: input.qrTippingEnabled ?? false,
        teamTippingEnabled: input.teamTippingEnabled ?? true,
        individualTippingEnabled: input.individualTippingEnabled ?? false,
        shiftSelectorEnabled: input.shiftSelectorEnabled ?? false,
      },
      update: input,
    });
  }

  async updateServiceAreaSetting(
    customerId: string,
    serviceAreaId: string,
    input: Partial<{
      tippingMode: "TEAM_ONLY" | "INDIVIDUAL_ONLY" | "TEAM_OR_INDIVIDUAL" | "SHIFT_SELECTOR";
      teamTippingEnabled: boolean;
      individualTippingEnabled: boolean;
    }>,
  ) {
    const serviceArea = await prisma.serviceArea.findFirst({
      where: {
        id: serviceAreaId,
        customerId,
      },
      select: {
        id: true,
      },
    });

    if (!serviceArea) {
      throw new NotFoundError("Service area not found");
    }

    return prisma.serviceArea.update({
      where: { id: serviceAreaId },
      data: input,
      select: {
        id: true,
        name: true,
        tippingMode: true,
        teamTippingEnabled: true,
        individualTippingEnabled: true,
      },
    });
  }
}
