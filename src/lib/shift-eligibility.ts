import type { PrismaClient, TippingMode } from "@prisma/client";

import { prisma } from "./prisma";

type ServiceAreaEligibilityInput = {
  serviceAreaId: string;
  venueId: string;
  departmentId: string;
  tippingMode: TippingMode;
  noActiveShiftBehavior: "DISABLE_INDIVIDUAL" | "FALLBACK_TO_TEAM";
  now?: Date;
};

export type ServiceAreaEligibility = {
  effectiveTippingMode: TippingMode;
  staffOptions: Array<{
    id: string;
    displayName: string;
    roleLabel?: string;
    sortOrder: number;
  }>;
  individualTippingUnavailable: boolean;
  individualTippingMessage: string | null;
};

export class ShiftEligibilityService {
  constructor(
    private readonly db: Pick<
      PrismaClient,
      "shift" | "staffMember" | "departmentStaffAssignment"
    > = prisma,
  ) {}

  async getActiveShiftStaffByServiceArea(input: ServiceAreaEligibilityInput) {
    const now = input.now ?? new Date();
    const shift = await this.db.shift.findFirst({
      where: {
        venueId: input.venueId,
        departmentId: input.departmentId,
        status: "ACTIVE",
        startsAt: {
          lte: now,
        },
        endsAt: {
          gte: now,
        },
      },
      include: {
        staffAssignments: {
          where: {
            eligibleForTips: true,
          },
          include: {
            staffMember: {
              include: {
                departmentAssignments: {
                  where: {
                    departmentId: input.departmentId,
                    isActive: true,
                    OR: [{ activeTo: null }, { activeTo: { gt: now } }],
                  },
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        startsAt: "desc",
      },
    });

    if (!shift) {
      return this.resolveNoActiveShift(input);
    }

    const staffOptions = shift.staffAssignments
      .filter(
        (assignment) =>
          assignment.staffMember.status === "ACTIVE" &&
          assignment.staffMember.departmentAssignments.length > 0,
      )
      .map((assignment) => ({
        id: assignment.staffMember.id,
        displayName:
          assignment.staffMember.displayName ??
          `${assignment.staffMember.firstName} ${assignment.staffMember.lastName}`,
        roleLabel: assignment.role ?? undefined,
      }))
      .sort((left, right) => {
        const byName = left.displayName.localeCompare(right.displayName, undefined, {
          sensitivity: "base",
        });

        if (byName !== 0) {
          return byName;
        }

        return left.id.localeCompare(right.id);
      })
      .map((staffOption, index) => ({
        ...staffOption,
        sortOrder: index,
      }));

    if (staffOptions.length === 0) {
      return this.resolveNoActiveShift(input);
    }

    return {
      effectiveTippingMode: input.tippingMode,
      staffOptions,
      individualTippingUnavailable: false,
      individualTippingMessage: null,
    } satisfies ServiceAreaEligibility;
  }

  private resolveNoActiveShift(input: ServiceAreaEligibilityInput): ServiceAreaEligibility {
    if (input.noActiveShiftBehavior === "FALLBACK_TO_TEAM") {
      return {
        effectiveTippingMode: "TEAM_ONLY",
        staffOptions: [],
        individualTippingUnavailable: false,
        individualTippingMessage: null,
      };
    }

    if (input.tippingMode === "TEAM_OR_INDIVIDUAL") {
      return {
        effectiveTippingMode: "TEAM_ONLY",
        staffOptions: [],
        individualTippingUnavailable: true,
        individualTippingMessage: "Individual tipping is unavailable right now.",
      };
    }

    return {
      effectiveTippingMode: input.tippingMode,
      staffOptions: [],
      individualTippingUnavailable: true,
      individualTippingMessage: "There is no active shift available for individual tipping right now.",
    };
  }
}

export const shiftEligibilityService = new ShiftEligibilityService();
