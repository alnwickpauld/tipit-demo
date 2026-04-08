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
  venueBrandName: string;
  venueLocation: string;
  brandBackgroundColor: string;
  brandTextColor: string;
  brandButtonColor: string;
  brandButtonTextColor: string;
  brandLogoImageUrl: string | null;
  serviceAreaJourney: PublicTipServiceAreaJourney | null;
};
