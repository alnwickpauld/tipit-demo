import { z } from "zod";

const percentSchema = z.number().min(0).max(100).multipleOf(0.01);

export const createCustomerSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  legalName: z.string().min(2).optional(),
  billingEmail: z.string().email(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).default("ACTIVE"),
  tipitFeePercent: percentSchema,
  payrollFrequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]),
  payrollAnchorDate: z.coerce.date().optional(),
  settlementFrequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]).default("WEEKLY"),
  contactPhone: z.string().min(5).optional(),
  currency: z.string().default("GBP"),
  timezone: z.string().default("Europe/London"),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const updateCustomerStatusSchema = z.object({
  status: z.enum(["INACTIVE", "SUSPENDED"]),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type UpdateCustomerStatusInput = z.infer<typeof updateCustomerStatusSchema>;
