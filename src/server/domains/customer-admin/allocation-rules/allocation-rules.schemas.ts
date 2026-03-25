import { z } from "zod";

export const allocationRuleLineSchema = z.object({
  recipientType: z.enum(["STAFF", "POOL"]),
  staffMemberId: z.string().optional(),
  poolId: z.string().optional(),
  percentageBps: z.number().int().min(1).max(10_000),
  sortOrder: z.number().int().default(0),
});

export const createAllocationRuleSchema = z.object({
  venueId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  priority: z.number().int().default(100),
  isActive: z.boolean().default(true),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
  lines: z.array(allocationRuleLineSchema).min(1),
});

export const updateAllocationRuleSchema = createAllocationRuleSchema.partial();
