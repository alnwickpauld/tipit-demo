import { prisma } from "../../../../lib/prisma";
import { NotFoundError } from "../../../shared/errors/app-error";

const DEPARTMENT_TYPES = [
  "MEETING_EVENTS",
  "BREAKFAST",
  "ROOM_SERVICE",
  "BAR",
  "RESTAURANT",
  "OTHER",
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
            departmentType: "asc",
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
                type: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const departmentTippingSettings = DEPARTMENT_TYPES.map((departmentType) => {
      const existing = customer.departmentTippingSettings.find(
        (setting) => setting.departmentType === departmentType,
      );

      return (
        existing ?? {
          id: `default-${customer.id}-${departmentType}`,
          customerId: customer.id,
          departmentType,
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
    departmentType:
      | "MEETING_EVENTS"
      | "BREAKFAST"
      | "ROOM_SERVICE"
      | "BAR"
      | "RESTAURANT"
      | "OTHER",
    input: Partial<{
      qrTippingEnabled: boolean;
      teamTippingEnabled: boolean;
      individualTippingEnabled: boolean;
      shiftSelectorEnabled: boolean;
    }>,
  ) {
    return prisma.customerDepartmentTippingSetting.upsert({
      where: {
        customerId_departmentType: {
          customerId,
          departmentType,
        },
      },
      create: {
        customerId,
        departmentType,
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
