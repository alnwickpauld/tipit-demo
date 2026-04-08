import { getPublicTipDestinationBySlug } from "./public-tip";

export type PublicTipStaffSelectionResponse = {
  slug: string;
  destinationType: "EMPLOYEE" | "POOL" | "VENUE" | "SERVICE_AREA";
  serviceAreaId: string | null;
  tippingMode: "TEAM_ONLY" | "INDIVIDUAL_ONLY" | "TEAM_OR_INDIVIDUAL" | "SHIFT_SELECTOR" | null;
  selectionUi: "LIST" | "DROPDOWN" | null;
  teamOptionEnabled: boolean;
  individualSelectionEnabled: boolean;
  individualTippingUnavailable: boolean;
  individualTippingMessage: string | null;
  items: Array<{
    id: string;
    displayName: string;
    roleLabel?: string;
    sortOrder: number;
  }>;
};

export async function getPublicTipStaffSelectionBySlug(
  slug: string,
): Promise<PublicTipStaffSelectionResponse | null> {
  const destination = await getPublicTipDestinationBySlug(slug);

  if (!destination) {
    return null;
  }

  const journey = destination.serviceAreaJourney;

  return {
    slug: destination.slug,
    destinationType: destination.destinationType,
    serviceAreaId: journey?.serviceAreaId ?? null,
    tippingMode: journey?.tippingMode ?? null,
    selectionUi: journey?.selectionUi ?? null,
    teamOptionEnabled: journey?.showTeamOption ?? false,
    individualSelectionEnabled:
      journey !== null &&
      (journey.tippingMode === "INDIVIDUAL_ONLY" ||
        journey.tippingMode === "TEAM_OR_INDIVIDUAL" ||
        journey.tippingMode === "SHIFT_SELECTOR"),
    individualTippingUnavailable: journey?.individualTippingUnavailable ?? false,
    individualTippingMessage: journey?.individualTippingMessage ?? null,
    items: journey?.activeShiftStaff ?? [],
  };
}
