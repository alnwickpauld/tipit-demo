const localAppUrl = "http://127.0.0.1:3000";

export function getPublicAppBaseUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return localAppUrl;
}

export function getStaffTipSlug(staffMemberId: string) {
  return `staff-${staffMemberId}`;
}

export function getPoolTipSlug(poolId: string) {
  return `pool-${poolId}`;
}

export function getVenueTipSlug(venueId: string) {
  return `venue-${venueId}`;
}

export function getPublicTipUrl(slug: string) {
  return `${getPublicAppBaseUrl()}/tip/${slug}`;
}

export function getStaffTipUrl(staffMemberId: string) {
  return getPublicTipUrl(getStaffTipSlug(staffMemberId));
}

export function getPoolTipUrl(poolId: string) {
  return getPublicTipUrl(getPoolTipSlug(poolId));
}

export function getVenueTipUrl(venueId: string) {
  return getPublicTipUrl(getVenueTipSlug(venueId));
}
