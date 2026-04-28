import { z } from "zod";
import { revenueCentreTypes } from "../../../../lib/revenue-centres";

const revenueCentreTypeSchema = z.enum(revenueCentreTypes);

export const listDepartmentsQuerySchema = z.object({
  customerId: z.string().min(1).optional(),
  venueId: z.string().min(1).optional(),
  revenueCentreType: revenueCentreTypeSchema.optional(),
  search: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createDepartmentSchema = z.object({
  customerId: z.string().min(1).optional(),
  venueId: z.string().min(1),
  outletBrandId: z.string().min(1),
  name: z.string().min(2),
  slug: z.string().min(2),
  revenueCentreType: revenueCentreTypeSchema.default("RESTAURANT"),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
