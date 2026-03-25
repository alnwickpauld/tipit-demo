import { z } from "zod";

export const updatePayrollSettingsSchema = z.object({
  frequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]),
  settlementFrequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]).optional(),
  payPeriodAnchor: z.coerce.date().optional(),
  settlementDay: z.number().int().min(1).max(31).optional(),
  exportEmail: z.string().email().optional(),
  notes: z.string().optional(),
  timezone: z.string().min(1).optional(),
  currency: z.string().min(3).max(3).optional(),
});
