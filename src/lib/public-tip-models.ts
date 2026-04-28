export type PublicTipDestinationType = "EMPLOYEE" | "POOL" | "VENUE" | "SERVICE_AREA";

export type PublicTipStaffOption = {
  id: string;
  displayName: string;
  roleLabel?: string;
  sortOrder: number;
};

export type PublicTipServiceAreaJourney = {
  serviceAreaId: string;
  serviceAreaName: string;
  departmentName: string;
  revenueCentreType: "RESTAURANT" | "BAR" | "MEETINGS_EVENTS" | "BREAKFAST" | "ROOM_SERVICE";
  tippingMode: "TEAM_ONLY" | "INDIVIDUAL_ONLY" | "TEAM_OR_INDIVIDUAL" | "SHIFT_SELECTOR";
  displayMode: "FIXED_SIGN" | "TABLE_CARD" | "BILL_FOLDER" | "COUNTER_SIGN" | "EVENT_SIGN" | "OTHER";
  showTeamOption: boolean;
  selectionUi: "LIST" | "DROPDOWN";
  individualTippingUnavailable: boolean;
  individualTippingMessage: string | null;
  activeShiftStaff: PublicTipStaffOption[];
};

export type PublicTipPageData = {
  qrCodeId: string;
  slug: string;
  label: string;
  destinationType: PublicTipDestinationType;
  destinationEmployeeId: string | null;
  destinationPoolId: string | null;
  destinationVenueId: string | null;
  destinationServiceAreaId: string | null;
  customerId: string;
  venueId: string;
  customerName: string;
  venueName: string;
  venueSlug: string;
  currency: string;
  heading: string;
  subheading: string;
  targetName: string;
  outletBrandId: string | null;
  brandDisplayName: string;
  venueBrandName: string;
  venueLocation: string;
  brandBackgroundColor: string;
  brandTextColor: string;
  brandButtonColor: string;
  brandButtonTextColor: string;
  brandLogoImageUrl: string | null;
  serviceAreaJourney: PublicTipServiceAreaJourney | null;
};

export type PublicTipPageResponse = {
  slug: string;
  label: string;
  destinationType: PublicTipDestinationType;
  currency: string;
  heading: string;
  subheading: string;
  targetName: string;
  brandDisplayName: string;
  venueBrandName: string;
  venueLocation: string;
  brandBackgroundColor: string;
  brandTextColor: string;
  brandButtonColor: string;
  brandButtonTextColor: string;
  brandLogoImageUrl: string | null;
  serviceAreaJourney: {
    departmentName: string;
    tippingMode: "TEAM_ONLY" | "INDIVIDUAL_ONLY" | "TEAM_OR_INDIVIDUAL" | "SHIFT_SELECTOR";
    displayMode: "FIXED_SIGN" | "TABLE_CARD" | "BILL_FOLDER" | "COUNTER_SIGN" | "EVENT_SIGN" | "OTHER";
    showTeamOption: boolean;
    selectionUi: "LIST" | "DROPDOWN";
    individualTippingUnavailable: boolean;
    individualTippingMessage: string | null;
    activeShiftStaff: PublicTipStaffOption[];
  } | null;
};

export function toPublicTipPageResponse(
  data: PublicTipPageData,
): PublicTipPageResponse {
  return {
    slug: data.slug,
    label: data.label,
    destinationType: data.destinationType,
    currency: data.currency,
    heading: data.heading,
    subheading: data.subheading,
    targetName: data.targetName,
    brandDisplayName: data.brandDisplayName,
    venueBrandName: data.venueBrandName,
    venueLocation: data.venueLocation,
    brandBackgroundColor: data.brandBackgroundColor,
    brandTextColor: data.brandTextColor,
    brandButtonColor: data.brandButtonColor,
    brandButtonTextColor: data.brandButtonTextColor,
    brandLogoImageUrl: data.brandLogoImageUrl,
    serviceAreaJourney: data.serviceAreaJourney
      ? {
          departmentName: data.serviceAreaJourney.departmentName,
          tippingMode: data.serviceAreaJourney.tippingMode,
          displayMode: data.serviceAreaJourney.displayMode,
          showTeamOption: data.serviceAreaJourney.showTeamOption,
          selectionUi: data.serviceAreaJourney.selectionUi,
          individualTippingUnavailable: data.serviceAreaJourney.individualTippingUnavailable,
          individualTippingMessage: data.serviceAreaJourney.individualTippingMessage,
          activeShiftStaff: data.serviceAreaJourney.activeShiftStaff,
        }
      : null,
  };
}
