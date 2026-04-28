import { z } from "zod";

export const updatePayrollSettingsSchema = z.object({
  frequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]),
  settlementFrequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]).optional(),
  payPeriodAnchor: z.coerce.date().optional(),
  payrollCalendarStartDate: z.coerce.date().optional(),
  periodsPerYear: z.number().int().min(1).max(366).optional(),
  periodLengthDays: z.number().int().min(1).max(366).optional(),
  startDayOfWeek: z.number().int().min(0).max(6).optional(),
  settlementDay: z.number().int().min(1).max(31).optional(),
  exportEmail: z.string().email().optional(),
  notes: z.string().optional(),
  timezone: z.string().min(1).optional(),
  currency: z.string().min(3).max(3).optional(),
});
