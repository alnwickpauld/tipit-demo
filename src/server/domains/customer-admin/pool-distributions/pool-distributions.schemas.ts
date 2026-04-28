import { z } from "zod";

export const poolDistributionQuerySchema = z.object({
  poolId: z.string().min(1),
  payrollPeriodId: z.string().min(1),
});

export const savePoolHoursEntriesSchema = z.object({
  poolId: z.string().min(1),
  payrollPeriodId: z.string().min(1),
  poolTotal: z.number().min(0).optional(),
  entries: z
    .array(
      z.object({
        employeeId: z.string().min(1),
        hoursWorked: z.number().min(0),
        source: z.enum(["MANUAL", "CSV_IMPORT", "INTEGRATION"]).default("MANUAL"),
      }),
    )
    .min(1),
});

export const previewPoolDistributionSchema = z.object({
  poolId: z.string().min(1),
  payrollPeriodId: z.string().min(1),
  poolTotal: z.number().min(0),
});

export const lockPoolDistributionSchema = previewPoolDistributionSchema;

export const exportPoolDistributionRowsQuerySchema = z.object({
  payrollPeriodId: z.string().min(1),
  venueId: z.string().min(1).optional(),
});
