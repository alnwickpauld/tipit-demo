import { cache } from "react";

import { prisma } from "./prisma";
import { getPoolTipSlug, getStaffTipSlug, getVenueTipSlug } from "./public-tip-links";

export type PublicTipDestinationType = "EMPLOYEE" | "POOL" | "VENUE";

export type PublicTipDestination = {
  qrCodeId: string;
  slug: string;
  label: string;
  destinationType: PublicTipDestinationType;
  destinationEmployeeId: string | null;
  destinationPoolId: string | null;
  destinationVenueId: string | null;
  customerId: string;
  venueId: string;
  customerName: string;
  venueName: string;
  venueSlug: string;
  currency: string;
  heading: string;
  subheading: string;
  targetName: string;
  venueBrandName: string;
  venueLocation: string;
  brandBackgroundColor: string;
  brandTextColor: string;
  brandButtonColor: string;
  brandButtonTextColor: string;
  brandLogoImageUrl: string | null;
};

export const getPublicTipDestinationBySlug = cache(
  async (slug: string): Promise<PublicTipDestination | null> => {
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
        const employeeName =
          staffMember.displayName ?? `${staffMember.firstName} ${staffMember.lastName}`;

        return {
          qrCodeId: `staff-${staffMember.id}`,
          slug,
          label: `Tip ${employeeName}`,
          destinationType: "EMPLOYEE",
          destinationEmployeeId: staffMember.id,
          destinationPoolId: null,
          destinationVenueId: staffMember.venueId,
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
        };
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
        return {
          qrCodeId: `pool-${pool.id}`,
          slug,
          label: `Tip the ${pool.name}`,
          destinationType: "POOL",
          destinationEmployeeId: null,
          destinationPoolId: pool.id,
          destinationVenueId: pool.venueId,
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
        };
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
        return {
          qrCodeId: `venue-${venue.id}`,
          slug,
          label: `Tip the team at ${venue.name}`,
          destinationType: "VENUE",
          destinationEmployeeId: null,
          destinationPoolId: null,
          destinationVenueId: venue.id,
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
        };
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
        },
        pools: {
          where: { status: "ACTIVE" },
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
      return getPublicTipDestinationBySlug(getStaffTipSlug(maya.id));
    }

    if (slug === "floor-team-pool" && floorPool) {
      return getPublicTipDestinationBySlug(getPoolTipSlug(floorPool.id));
    }

    if (slug === "shark-club-team") {
      return getPublicTipDestinationBySlug(getVenueTipSlug(venue.id));
    }

    return null;
  },
);
