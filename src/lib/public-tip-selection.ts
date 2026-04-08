import type { TipSelectionType } from "@prisma/client";

import type { PublicTipPageData } from "./public-tip-models";

export type ResolvedTipSelection = {
  resolvedDestination: PublicTipPageData;
  guestSelectionType: TipSelectionType;
};

type ResolveTipSelectionInput = {
  destination: PublicTipPageData;
  selectedRecipientMode?: TipSelectionType | null;
  selectedStaffMemberId?: string | null;
};

export function resolveTipSelectionFromPublicFlow(
  input: ResolveTipSelectionInput,
): ResolvedTipSelection {
  const { destination } = input;

  if (destination.destinationType === "EMPLOYEE") {
    return {
      resolvedDestination: destination,
      guestSelectionType: "INDIVIDUAL",
    };
  }

  if (destination.destinationType === "POOL" || destination.destinationType === "VENUE") {
    return {
      resolvedDestination: destination,
      guestSelectionType: "TEAM",
    };
  }

  if (destination.destinationType !== "SERVICE_AREA" || !destination.serviceAreaJourney) {
    return {
      resolvedDestination: destination,
      guestSelectionType: "TEAM",
    };
  }

  const journey = destination.serviceAreaJourney;
  const implicitMode =
    journey.tippingMode === "INDIVIDUAL_ONLY"
      ? "INDIVIDUAL"
      : journey.tippingMode === "SHIFT_SELECTOR" && !journey.showTeamOption
        ? "INDIVIDUAL"
        : "TEAM";
  const guestSelectionType = input.selectedRecipientMode ?? implicitMode;

  if (journey.tippingMode === "TEAM_ONLY" && guestSelectionType !== "TEAM") {
    throw new Error("INVALID_RECIPIENT_SELECTION");
  }

  if (
    (journey.tippingMode === "INDIVIDUAL_ONLY" ||
      (journey.tippingMode === "SHIFT_SELECTOR" && !journey.showTeamOption)) &&
    guestSelectionType !== "INDIVIDUAL"
  ) {
    throw new Error("INVALID_RECIPIENT_SELECTION");
  }

  if (guestSelectionType === "TEAM") {
    return {
      guestSelectionType,
      resolvedDestination: {
        ...destination,
        destinationEmployeeId: null,
      },
    };
  }

  const selectedStaffMember = journey.activeShiftStaff.find(
    (staffMember) => staffMember.id === input.selectedStaffMemberId,
  );

  if (!selectedStaffMember) {
    throw new Error("SELECTED_STAFF_MEMBER_REQUIRED");
  }

  return {
    guestSelectionType,
    resolvedDestination: {
      ...destination,
      destinationEmployeeId: selectedStaffMember.id,
      targetName: selectedStaffMember.displayName,
    },
  };
}
