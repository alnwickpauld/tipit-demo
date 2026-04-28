import { z } from "zod";

const dateSchema = z.coerce.date();

export const listTipOutRulesQuerySchema = z.object({
  venueId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
});

export const createTipOutRuleSchema = z.object({
  scope: z.enum(["CUSTOMER", "VENUE", "DEPARTMENT"]).default("VENUE"),
  venueId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  targetPoolId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  rateDecimal: z.number().min(0).max(1),
  capAtAvailableTipBalance: z.boolean().default(true),
  isActive: z.boolean().default(true),
  effectiveFrom: dateSchema.optional(),
  effectiveTo: dateSchema.optional(),
});

export const updateTipOutRuleSchema = createTipOutRuleSchema.partial();

export const previewTipOutSchema = z.object({
  tipOutRuleId: z.string().min(1).optional(),
  venueId: z.string().min(1),
  departmentId: z.string().min(1).optional(),
  staffMemberId: z.string().min(1),
  importedServiceChargeId: z.string().min(1).optional(),
  businessDate: dateSchema.optional(),
  totalSales: z.number().min(0).optional(),
  discounts: z.number().min(0).optional(),
  availableTipBalance: z.number().min(0).optional(),
});

export const createTipOutPostingSchema = previewTipOutSchema;

export const previewTipOutPayrollDistributionSchema = z.object({
  poolId: z.string().min(1),
  payrollPeriodId: z.string().min(1),
});

export const saveManualTipOutHoursSchema = z.object({
  poolId: z.string().min(1),
  payrollPeriodId: z.string().min(1),
  entries: z
    .array(
      z.object({
        staffMemberId: z.string().min(1),
        hoursWorked: z.number().min(0),
      }),
    )
    .min(1),
});
