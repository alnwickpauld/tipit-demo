import { z } from "zod";

export const allocationRuleLineSchema = z.object({
  recipientType: z.enum(["STAFF", "POOL", "SELECTED_STAFF"]),
  staffMemberId: z.string().optional(),
  poolId: z.string().optional(),
  percentageBps: z.number().int().min(1).max(10_000),
  sortOrder: z.number().int().default(0),
});

export const createAllocationRuleSchema = z.object({
  venueId: z.string().min(1),
  departmentId: z.string().min(1).optional(),
  serviceAreaId: z.string().min(1).optional(),
  scope: z.enum(["VENUE_DEFAULT", "DEPARTMENT", "SERVICE_AREA"]).default("VENUE_DEFAULT"),
  selectionType: z.enum(["TEAM", "INDIVIDUAL"]).optional(),
  name: z.string().min(2),
  description: z.string().optional(),
  priority: z.number().int().default(100),
  isActive: z.boolean().default(true),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
  lines: z.array(allocationRuleLineSchema).min(1),
});

export const updateAllocationRuleSchema = createAllocationRuleSchema.partial();

export const listAllocationRuleTemplatesQuerySchema = z.object({
  recommendedOnly: z.coerce.boolean().optional(),
  scope: z.enum(["VENUE_DEFAULT", "DEPARTMENT", "SERVICE_AREA"]).optional(),
  selectionType: z.enum(["TEAM", "INDIVIDUAL"]).optional(),
});

export const createAllocationRuleFromTemplateSchema = z.object({
  templateId: z.string().min(1),
  venueId: z.string().min(1),
  departmentId: z.string().min(1).optional(),
  serviceAreaId: z.string().min(1).optional(),
  scope: z.enum(["VENUE_DEFAULT", "DEPARTMENT", "SERVICE_AREA"]).optional(),
  selectionType: z.enum(["TEAM", "INDIVIDUAL"]).optional(),
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
  lineRecipients: z
    .array(
      z.object({
        sortOrder: z.number().int(),
        staffMemberId: z.string().optional(),
        poolId: z.string().optional(),
      }),
    )
    .default([]),
});
