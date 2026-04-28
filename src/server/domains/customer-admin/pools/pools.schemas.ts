import { z } from "zod";
import { poolTypes } from "../../../../lib/pool-types";

const poolTypeSchema = z.enum(poolTypes);

export const listPoolsQuerySchema = z.object({
  poolType: poolTypeSchema.optional(),
});

export const createPoolSchema = z.object({
  venueId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  poolType: poolTypeSchema.default("HYBRID"),
  memberStaffIds: z.array(z.string()).default([]),
});

export const updatePoolSchema = createPoolSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const previewPoolDistributionSchema = z.object({
  poolTotal: z.number().min(0),
  staffHours: z
    .array(
      z.object({
        staffMemberId: z.string().min(1),
        hoursWorked: z.number().min(0),
      }),
    )
    .default([]),
});
