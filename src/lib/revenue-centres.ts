export const revenueCentreTypes = [
  "RESTAURANT",
  "BAR",
  "MEETINGS_EVENTS",
  "BREAKFAST",
  "ROOM_SERVICE",
] as const;

export type RevenueCentreType = (typeof revenueCentreTypes)[number];

export const revenueCentreLabels: Record<RevenueCentreType, string> = {
  RESTAURANT: "Restaurant",
  BAR: "Bar",
  MEETINGS_EVENTS: "Meetings & events",
  BREAKFAST: "Breakfast",
  ROOM_SERVICE: "Room service",
};

export function formatRevenueCentreType(value: RevenueCentreType) {
  return revenueCentreLabels[value];
}
