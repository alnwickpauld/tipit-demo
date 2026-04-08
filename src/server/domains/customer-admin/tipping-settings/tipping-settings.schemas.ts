import { z } from "zod";

const departmentTypeSchema = z.enum([
  "MEETING_EVENTS",
  "BREAKFAST",
  "ROOM_SERVICE",
  "BAR",
  "RESTAURANT",
  "OTHER",
]);

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

export const departmentTypeParamSchema = z.object({
  departmentType: departmentTypeSchema,
});

export type DepartmentTypeParam = z.infer<typeof departmentTypeParamSchema>;
