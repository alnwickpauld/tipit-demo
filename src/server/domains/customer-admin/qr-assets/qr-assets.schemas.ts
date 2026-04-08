import { z } from "zod";

const qrAssetDestinationTypeSchema = z.enum(["SERVICE_AREA", "TEAM", "STAFF_MEMBER"]);
const displayModeSchema = z.enum([
  "FIXED_SIGN",
  "TABLE_CARD",
  "BILL_FOLDER",
  "COUNTER_SIGN",
  "EVENT_SIGN",
  "OTHER",
]);

export const listQrAssetsQuerySchema = z.object({
  customerId: z.string().min(1).optional(),
  venueId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  destinationType: qrAssetDestinationTypeSchema.optional(),
  isActive: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .optional(),
  search: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const qrAssetPayloadSchema = z.object({
  customerId: z.string().min(1).optional(),
  venueId: z.string().min(1),
  departmentId: z.string().min(1).optional(),
  serviceAreaId: z.string().min(1).optional(),
  staffMemberId: z.string().min(1).optional(),
  slug: z.string().min(2),
  destinationType: qrAssetDestinationTypeSchema,
  label: z.string().min(2),
  printName: z.string().min(2),
  displayMode: displayModeSchema,
  isActive: z.boolean().optional(),
  previewConfig: z.record(z.string(), z.unknown()).optional(),
});

export const createQrAssetSchema = qrAssetPayloadSchema;
export const updateQrAssetSchema = qrAssetPayloadSchema.partial();

export type CreateQrAssetInput = z.infer<typeof createQrAssetSchema>;
export type UpdateQrAssetInput = z.infer<typeof updateQrAssetSchema>;
