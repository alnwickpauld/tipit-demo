import { z } from "zod";

export const createPoolSchema = z.object({
  venueId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  memberStaffIds: z.array(z.string()).default([]),
});

export const updatePoolSchema = createPoolSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
