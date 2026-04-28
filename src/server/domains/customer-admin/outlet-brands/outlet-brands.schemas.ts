import { z } from "zod";

const logoImageSchema = z
  .string()
  .max(2_000_000, "Logo image is too large.")
  .refine(
    (value) =>
      value.startsWith("data:image/") ||
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("/"),
    "Use a valid image upload or image URL.",
  );

export const listOutletBrandsQuerySchema = z.object({
  customerId: z.string().min(1).optional(),
  venueId: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createOutletBrandSchema = z.object({
  customerId: z.string().min(1).optional(),
  venueId: z.string().min(1),
  name: z.string().min(2),
  displayName: z.string().min(2),
  logoUrl: logoImageSchema.nullish(),
});

export const updateOutletBrandSchema = createOutletBrandSchema.partial();

export type CreateOutletBrandInput = z.infer<typeof createOutletBrandSchema>;
export type UpdateOutletBrandInput = z.infer<typeof updateOutletBrandSchema>;
