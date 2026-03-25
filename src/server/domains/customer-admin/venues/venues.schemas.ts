import { z } from "zod";

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour.");
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

const venueTypeSchema = z.enum([
  "HOTEL_BAR",
  "RESTAURANT",
  "CAFE",
  "HOSPITALITY_SUITE",
  "EVENT_SPACE",
  "OTHER",
]);

export const listVenuesQuerySchema = z.object({
  customerId: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createVenueSchema = z.object({
  customerId: z.string().min(1).optional(),
  name: z.string().min(2),
  slug: z.string().min(2),
  code: z.string().min(2).optional(),
  type: venueTypeSchema.optional(),
  address: z.string().min(2).optional(),
  timezone: z.string().min(1).optional(),
  description: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  brandBackgroundColor: hexColorSchema.optional(),
  brandTextColor: hexColorSchema.optional(),
  brandButtonColor: hexColorSchema.optional(),
  brandButtonTextColor: hexColorSchema.optional(),
  brandLogoImageUrl: logoImageSchema.nullish(),
});

export const updateVenueSchema = createVenueSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const updateVenueStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
