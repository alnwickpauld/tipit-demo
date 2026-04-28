import { z } from "zod";
import { revenueCentreTypes } from "../../../../lib/revenue-centres";

const revenueCentreTypeSchema = z.enum(revenueCentreTypes);

const tippingModeSchema = z.enum([
  "TEAM_ONLY",
  "INDIVIDUAL_ONLY",
  "TEAM_OR_INDIVIDUAL",
  "SHIFT_SELECTOR",
]);

export const updateDepartmentTippingSettingSchema = z.object({
  qrTippingEnabled: z.boolean().optional(),
  teamTippingEnabled: z.boolean().optional(),
  individualTippingEnabled: z.boolean().optional(),
  shiftSelectorEnabled: z.boolean().optional(),
});

export const updateServiceAreaTippingSettingSchema = z.object({
  tippingMode: tippingModeSchema.optional(),
  teamTippingEnabled: z.boolean().optional(),
  individualTippingEnabled: z.boolean().optional(),
});

export const revenueCentreTypeParamSchema = z.object({
  revenueCentreType: revenueCentreTypeSchema,
});

export type RevenueCentreTypeParam = z.infer<typeof revenueCentreTypeParamSchema>;
