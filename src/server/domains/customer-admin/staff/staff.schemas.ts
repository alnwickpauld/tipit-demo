import { z } from "zod";

export const listStaffQuerySchema = z.object({
  customerId: z.string().min(1).optional(),
  venueId: z.string().min(1).optional(),
});

export const createStaffSchema = z.object({
  customerId: z.string().min(1).optional(),
  venueId: z.string().min(1),
  externalPayrollRef: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  displayName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  staffCode: z.string().optional(),
});

export const updateStaffSchema = createStaffSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const updateStaffStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
