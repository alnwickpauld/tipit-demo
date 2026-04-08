import { cache } from "react";

import { prisma } from "./prisma";
import { resolveServiceAreaTippingConfig } from "./public-tip-config";
import type { PublicTipPageData, PublicTipDestinationType } from "./public-tip-models";
import {
  getPoolTipSlug,
  getServiceAreaTipSlug,
  getStaffTipSlug,
  getVenueTipSlug,
} from "./public-tip-links";
import { shiftEligibilityService } from "./shift-eligibility";

function buildStaffDestination(
  staffMember: {
    id: string;
    customerId: string;
    venueId: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    customer: { name: string; currency: string };
    venue: {
      name: string;
      slug: string;
      city: string | null;
      brandBackgroundColor: string;
      brandTextColor: string;
      brandButtonColor: string;
      brandButtonTextColor: string;
      brandLogoImageUrl: string | null;
    };
  },
  slug: string,
): PublicTipPageData {
  const employeeName = staffMember.displayName ?? `${staffMember.firstName} ${staffMember.lastName}`;

  return {
    qrCodeId: `staff-${staffMember.id}`,
    slug,
    label: `Tip ${employeeName}`,
    destinationType: "EMPLOYEE",
    destinationEmployeeId: staffMember.id,
    destinationPoolId: null,
    destinationVenueId: staffMember.venueId,
    destinationServiceAreaId: null,
    customerId: staffMember.customerId,
    venueId: staffMember.venueId,
    customerName: staffMember.customer.name,
    venueName: staffMember.venue.name,
    venueSlug: staffMember.venue.slug,
    currency: staffMember.customer.currency,
    heading: `Tip ${employeeName}`,
    subheading: `Securely send a thank-you to ${employeeName} at ${staffMember.venue.name}.`,
    targetName: employeeName,
    venueBrandName: staffMember.customer.name,
    venueLocation: staffMember.venue.city ?? staffMember.venue.name,
    brandBackgroundColor: staffMember.venue.brandBackgroundColor,
    brandTextColor: staffMember.venue.brandTextColor,
    brandButtonColor: staffMember.venue.brandButtonColor,
    brandButtonTextColor: staffMember.venue.brandButtonTextColor,
    brandLogoImageUrl: staffMember.venue.brandLogoImageUrl,
    serviceAreaJourney: null,
  };
}

function buildPoolDestination(
  pool: {
    id: string;
    name: string;
    customerId: string;
    venueId: string;
    customer: { name: string; currency: string };
    venue: {
      name: string;
      slug: string;
      city: string | null;
      brandBackgroundColor: string;
      brandTextColor: string;
      brandButtonColor: string;
      brandButtonTextColor: string;
      brandLogoImageUrl: string | null;
    };
  },
  slug: string,
): PublicTipPageData {
  return {
    qrCodeId: `pool-${pool.id}`,
    slug,
    label: `Tip the ${pool.name}`,
    destinationType: "POOL",
    destinationEmployeeId: null,
    destinationPoolId: pool.id,
    destinationVenueId: pool.venueId,
    destinationServiceAreaId: null,
    customerId: pool.customerId,
    venueId: pool.venueId,
    customerName: pool.customer.name,
    venueName: pool.venue.name,
    venueSlug: pool.venue.slug,
    currency: pool.customer.currency,
    heading: `Tip the ${pool.name}`,
    subheading: `Your tip will be shared across the active ${pool.name.toLowerCase()}.`,
    targetName: pool.name,
    venueBrandName: pool.customer.name,
    venueLocation: pool.venue.city ?? pool.venue.name,
    brandBackgroundColor: pool.venue.brandBackgroundColor,
    brandTextColor: pool.venue.brandTextColor,
    brandButtonColor: pool.venue.brandButtonColor,
    brandButtonTextColor: pool.venue.brandButtonTextColor,
    brandLogoImageUrl: pool.venue.brandLogoImageUrl,
    serviceAreaJourney: null,
  };
}

function buildVenueDestination(
  venue: {
    id: string;
    name: string;
    slug: string;
    customerId: string;
    city: string | null;
    brandBackgroundColor: string;
    brandTextColor: string;
    brandButtonColor: string;
    brandButtonTextColor: string;
    brandLogoImageUrl: string | null;
    customer: { name: string; currency: string };
  },
  slug: string,
): PublicTipPageData {
  return {
    qrCodeId: `venue-${venue.id}`,
    slug,
    label: `Tip the team at ${venue.name}`,
    destinationType: "VENUE",
    destinationEmployeeId: null,
    destinationPoolId: null,
    destinationVenueId: venue.id,
    destinationServiceAreaId: null,
    customerId: venue.customerId,
    venueId: venue.id,
    customerName: venue.customer.name,
    venueName: venue.name,
    venueSlug: venue.slug,
    currency: venue.customer.currency,
    heading: `Tip the team at ${venue.name}`,
    subheading: "Support the service team with a secure digital tip.",
    targetName: venue.name,
    venueBrandName: venue.customer.name,
    venueLocation: venue.city ?? venue.name,
    brandBackgroundColor: venue.brandBackgroundColor,
    brandTextColor: venue.brandTextColor,
    brandButtonColor: venue.brandButtonColor,
    brandButtonTextColor: venue.brandButtonTextColor,
    brandLogoImageUrl: venue.brandLogoImageUrl,
    serviceAreaJourney: null,
  };
}

function buildServiceAreaDestination(
  serviceArea: {
    id: string;
    customerId: string;
    venueId: string;
    name: string;
    tippingMode: string;
    displayMode: string;
    noActiveShiftBehavior: "DISABLE_INDIVIDUAL" | "FALLBACK_TO_TEAM";
    customer: { name: string; currency: string };
    venue: {
      name: string;
      slug: string;
      city: string | null;
      brandBackgroundColor: string;
      brandTextColor: string;
      brandButtonColor: string;
      brandButtonTextColor: string;
      brandLogoImageUrl: string | null;
    };
    department: {
      name: string;
      type?: string;
    };
  },
  resolvedConfig: {
    effectiveTippingMode: "TEAM_ONLY" | "INDIVIDUAL_ONLY" | "TEAM_OR_INDIVIDUAL" | "SHIFT_SELECTOR";
    showTeamOption: boolean;
  },
  eligibility: {
    effectiveTippingMode: string;
    individualTippingUnavailable: boolean;
    individualTippingMessage: string | null;
    staffOptions: Array<{
      id: string;
      displayName: string;
      roleLabel?: string;
      sortOrder: number;
    }>;
  },
  slug: string,
): PublicTipPageData {
  const departmentLabel =
    serviceArea.department.name === "Meeting & Events" ? "M&E" : serviceArea.department.name;
  const teamName = `${departmentLabel} team`;
  const finalTippingMode = eligibility.effectiveTippingMode as
    | "TEAM_ONLY"
    | "INDIVIDUAL_ONLY"
    | "TEAM_OR_INDIVIDUAL"
    | "SHIFT_SELECTOR";
  const showTeamOption =
    finalTippingMode === "TEAM_OR_INDIVIDUAL"
      ? true
      : finalTippingMode === "SHIFT_SELECTOR"
        ? resolvedConfig.showTeamOption
        : false;
  const selectionUi = finalTippingMode === "SHIFT_SELECTOR" ? "DROPDOWN" : "LIST";
  const serviceHeading =
    serviceArea.department.name === "Room Service"
      ? "Tip today's Room Service Team"
      : `Tip the ${departmentLabel} Team`;

  return {
    qrCodeId: `service-area-${serviceArea.id}`,
    slug,
    label: `Tip the ${teamName}`,
    destinationType: "SERVICE_AREA",
    destinationEmployeeId: null,
    destinationPoolId: null,
    destinationVenueId: serviceArea.venueId,
    destinationServiceAreaId: serviceArea.id,
    customerId: serviceArea.customerId,
    venueId: serviceArea.venueId,
    customerName: serviceArea.customer.name,
    venueName: serviceArea.venue.name,
    venueSlug: serviceArea.venue.slug,
    currency: serviceArea.customer.currency,
    heading: serviceHeading,
    subheading: `Support ${serviceArea.department.name.toLowerCase()} service at ${serviceArea.name}.`,
    targetName: teamName,
    venueBrandName: serviceArea.customer.name,
    venueLocation: serviceArea.venue.city ?? serviceArea.venue.name,
    brandBackgroundColor: serviceArea.venue.brandBackgroundColor,
    brandTextColor: serviceArea.venue.brandTextColor,
    brandButtonColor: serviceArea.venue.brandButtonColor,
    brandButtonTextColor: serviceArea.venue.brandButtonTextColor,
    brandLogoImageUrl: serviceArea.venue.brandLogoImageUrl,
    serviceAreaJourney: {
      serviceAreaId: serviceArea.id,
      serviceAreaName: serviceArea.name,
      departmentName: serviceArea.department.name,
      tippingMode: finalTippingMode,
      displayMode: serviceArea.displayMode as
        | "FIXED_SIGN"
        | "TABLE_CARD"
        | "BILL_FOLDER"
        | "COUNTER_SIGN"
        | "EVENT_SIGN"
        | "OTHER",
      showTeamOption,
      selectionUi,
      individualTippingUnavailable: eligibility.individualTippingUnavailable,
      individualTippingMessage: eligibility.individualTippingMessage,
      activeShiftStaff: eligibility.staffOptions,
    },
  };
}

export async function resolvePublicTipDestinationBySlug(
  slug: string,
): Promise<PublicTipPageData | null> {
    const qrAsset = await prisma.qrAsset.findFirst({
      where: {
        slug,
        isActive: true,
      },
      include: {
        venue: true,
        department: true,
        serviceArea: {
          include: {
            customer: true,
            venue: true,
            department: true,
          },
        },
        staffMember: {
          include: {
            customer: true,
            venue: true,
          },
        },
      },
    });

    if (qrAsset) {
      if (qrAsset.destinationType === "STAFF_MEMBER" && qrAsset.staffMember) {
        if (qrAsset.department) {
          const departmentSetting = await prisma.customerDepartmentTippingSetting.findUnique({
            where: {
              customerId_departmentType: {
                customerId: qrAsset.customerId,
                departmentType: qrAsset.department.type,
              },
            },
            select: {
              qrTippingEnabled: true,
              teamTippingEnabled: true,
              individualTippingEnabled: true,
              shiftSelectorEnabled: true,
            },
          });

          if (!departmentSetting?.qrTippingEnabled || !departmentSetting.individualTippingEnabled) {
            return null;
          }
        }

        return buildStaffDestination(qrAsset.staffMember, slug);
      }

      if ((qrAsset.destinationType === "SERVICE_AREA" || qrAsset.destinationType === "TEAM") && qrAsset.serviceArea) {
        const departmentSetting = await prisma.customerDepartmentTippingSetting.findUnique({
          where: {
            customerId_departmentType: {
              customerId: qrAsset.customerId,
              departmentType: qrAsset.serviceArea.department.type,
            },
          },
          select: {
            qrTippingEnabled: true,
            teamTippingEnabled: true,
            individualTippingEnabled: true,
            shiftSelectorEnabled: true,
          },
        });

        const resolvedConfig = resolveServiceAreaTippingConfig(
          departmentSetting ?? {
            qrTippingEnabled: false,
            teamTippingEnabled: false,
            individualTippingEnabled: false,
            shiftSelectorEnabled: false,
          },
          {
            tippingMode:
              qrAsset.destinationType === "TEAM" ? "TEAM_ONLY" : qrAsset.serviceArea.tippingMode,
            teamTippingEnabled:
              qrAsset.destinationType === "TEAM" ? true : qrAsset.serviceArea.teamTippingEnabled,
            individualTippingEnabled:
              qrAsset.destinationType === "TEAM" ? false : qrAsset.serviceArea.individualTippingEnabled,
          },
        );

        if (!resolvedConfig.enabled) {
          return null;
        }

        const eligibility = await shiftEligibilityService.getActiveShiftStaffByServiceArea({
          serviceAreaId: qrAsset.serviceArea.id,
          venueId: qrAsset.serviceArea.venueId,
          departmentId: qrAsset.serviceArea.departmentId,
          tippingMode: resolvedConfig.effectiveTippingMode,
          noActiveShiftBehavior: qrAsset.serviceArea.noActiveShiftBehavior,
        });

        return buildServiceAreaDestination(qrAsset.serviceArea, resolvedConfig, eligibility, slug);
      }
    }

    if (slug.startsWith("staff-")) {
      const staffMember = await prisma.staffMember.findFirst({
        where: {
          id: slug.slice("staff-".length),
          status: "ACTIVE",
        },
        include: {
          customer: true,
          venue: true,
        },
      });

      if (staffMember) {
        return buildStaffDestination(staffMember, slug);
      }
    }

    if (slug.startsWith("pool-")) {
      const pool = await prisma.pool.findFirst({
        where: {
          id: slug.slice("pool-".length),
          status: "ACTIVE",
        },
        include: {
          customer: true,
          venue: true,
        },
      });

      if (pool) {
        return buildPoolDestination(pool, slug);
      }
    }

    if (slug.startsWith("venue-")) {
      const venue = await prisma.venue.findFirst({
        where: {
          id: slug.slice("venue-".length),
          status: "ACTIVE",
        },
        include: {
          customer: true,
        },
      });

      if (venue) {
        return buildVenueDestination(venue, slug);
      }
    }

    if (slug.startsWith("service-area-")) {
      const serviceArea = await prisma.serviceArea.findFirst({
        where: {
          id: slug.slice("service-area-".length),
          isActive: true,
        },
        include: {
          customer: true,
          venue: true,
          department: true,
        },
      });

      if (serviceArea) {
        const departmentSetting = await prisma.customerDepartmentTippingSetting.findUnique({
          where: {
            customerId_departmentType: {
              customerId: serviceArea.customerId,
              departmentType: serviceArea.department.type,
            },
          },
          select: {
            qrTippingEnabled: true,
            teamTippingEnabled: true,
            individualTippingEnabled: true,
            shiftSelectorEnabled: true,
          },
        });

        const resolvedConfig = resolveServiceAreaTippingConfig(
          departmentSetting ?? {
            qrTippingEnabled: false,
            teamTippingEnabled: false,
            individualTippingEnabled: false,
            shiftSelectorEnabled: false,
          },
          {
            tippingMode: serviceArea.tippingMode,
            teamTippingEnabled: serviceArea.teamTippingEnabled,
            individualTippingEnabled: serviceArea.individualTippingEnabled,
          },
        );

        if (!resolvedConfig.enabled) {
          return null;
        }

        const eligibility = await shiftEligibilityService.getActiveShiftStaffByServiceArea({
          serviceAreaId: serviceArea.id,
          venueId: serviceArea.venueId,
          departmentId: serviceArea.departmentId,
          tippingMode: resolvedConfig.effectiveTippingMode,
          noActiveShiftBehavior: serviceArea.noActiveShiftBehavior,
        });

        return buildServiceAreaDestination(serviceArea, resolvedConfig, eligibility, slug);
      }
    }

    // Preserve the original seeded demo links so previously shared examples keep working.
    const venue = await prisma.venue.findFirst({
      where: { slug: "shark-club-newcastle" },
      include: {
        customer: true,
        staffMembers: {
          where: { status: "ACTIVE" },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          select: {
            id: true,
            customerId: true,
            venueId: true,
            firstName: true,
            lastName: true,
            displayName: true,
            departmentAssignments: {
              where: {
                isActive: true,
              },
              select: {
                departmentId: true,
              },
            },
          },
        },
        pools: {
          where: { status: "ACTIVE" },
          orderBy: { name: "asc" },
        },
        serviceAreas: {
          where: { isActive: true },
          include: {
            department: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!venue) {
      return null;
    }

    const maya =
      venue.staffMembers.find((staffMember) => staffMember.displayName === "Maya") ??
      venue.staffMembers[0];
    const floorPool = venue.pools[0];

    if (slug === "maya-table-qr" && maya) {
      return buildStaffDestination(
        {
          ...maya,
          customer: venue.customer,
          venue: {
            name: venue.name,
            slug: venue.slug,
            city: venue.city,
            brandBackgroundColor: venue.brandBackgroundColor,
            brandTextColor: venue.brandTextColor,
            brandButtonColor: venue.brandButtonColor,
            brandButtonTextColor: venue.brandButtonTextColor,
            brandLogoImageUrl: venue.brandLogoImageUrl,
          },
        },
        slug,
      );
    }

    if (slug === "floor-team-pool" && floorPool) {
      return buildPoolDestination(
        {
          ...floorPool,
          customer: venue.customer,
          venue: {
            name: venue.name,
            slug: venue.slug,
            city: venue.city,
            brandBackgroundColor: venue.brandBackgroundColor,
            brandTextColor: venue.brandTextColor,
            brandButtonColor: venue.brandButtonColor,
            brandButtonTextColor: venue.brandButtonTextColor,
            brandLogoImageUrl: venue.brandLogoImageUrl,
          },
        },
        slug,
      );
    }

    if (slug === "shark-club-team") {
      return buildVenueDestination(venue, slug);
    }

    const demoServiceArea = venue.serviceAreas[0];
    if (slug === "breakfast-table-card" && demoServiceArea) {
      const departmentSetting = await prisma.customerDepartmentTippingSetting.findUnique({
        where: {
          customerId_departmentType: {
            customerId: demoServiceArea.customerId,
            departmentType: demoServiceArea.department.type,
          },
        },
        select: {
          qrTippingEnabled: true,
          teamTippingEnabled: true,
          individualTippingEnabled: true,
          shiftSelectorEnabled: true,
        },
      });

      const resolvedConfig = resolveServiceAreaTippingConfig(
        departmentSetting ?? {
          qrTippingEnabled: false,
          teamTippingEnabled: false,
          individualTippingEnabled: false,
          shiftSelectorEnabled: false,
        },
        {
          tippingMode: demoServiceArea.tippingMode,
          teamTippingEnabled: demoServiceArea.teamTippingEnabled,
          individualTippingEnabled: demoServiceArea.individualTippingEnabled,
        },
      );

      if (!resolvedConfig.enabled) {
        return null;
      }

      const eligibility = await shiftEligibilityService.getActiveShiftStaffByServiceArea({
        serviceAreaId: demoServiceArea.id,
        venueId: demoServiceArea.venueId,
        departmentId: demoServiceArea.departmentId,
        tippingMode: resolvedConfig.effectiveTippingMode,
        noActiveShiftBehavior: demoServiceArea.noActiveShiftBehavior,
      });

      return buildServiceAreaDestination(
        {
          ...demoServiceArea,
          customer: venue.customer,
          venue: {
            name: venue.name,
            slug: venue.slug,
            city: venue.city,
            brandBackgroundColor: venue.brandBackgroundColor,
            brandTextColor: venue.brandTextColor,
            brandButtonColor: venue.brandButtonColor,
            brandButtonTextColor: venue.brandButtonTextColor,
            brandLogoImageUrl: venue.brandLogoImageUrl,
          },
        },
        resolvedConfig,
        eligibility,
        slug,
      );
    }

    return null;
}

export const getPublicTipDestinationBySlug = cache(resolvePublicTipDestinationBySlug);
