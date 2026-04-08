import { z } from "zod";

const tippingModeSchema = z.enum([
  "TEAM_ONLY",
  "INDIVIDUAL_ONLY",
  "TEAM_OR_INDIVIDUAL",
  "SHIFT_SELECTOR",
]);

const displayModeSchema = z.enum([
  "FIXED_SIGN",
  "TABLE_CARD",
  "BILL_FOLDER",
  "COUNTER_SIGN",
  "EVENT_SIGN",
  "OTHER",
]);

const noActiveShiftBehaviorSchema = z.enum([
  "DISABLE_INDIVIDUAL",
  "FALLBACK_TO_TEAM",
]);

export const listServiceAreasQuerySchema = z.object({
  customerId: z.string().min(1).optional(),
  venueId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createServiceAreaSchema = z.object({
  customerId: z.string().min(1).optional(),
  venueId: z.string().min(1),
  departmentId: z.string().min(1),
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),
  tippingMode: tippingModeSchema,
  displayMode: displayModeSchema,
  noActiveShiftBehavior: noActiveShiftBehaviorSchema.optional(),
  isActive: z.boolean().optional(),
});

export const updateServiceAreaSchema = createServiceAreaSchema.partial();

export type CreateServiceAreaInput = z.infer<typeof createServiceAreaSchema>;
export type UpdateServiceAreaInput = z.infer<typeof updateServiceAreaSchema>;
