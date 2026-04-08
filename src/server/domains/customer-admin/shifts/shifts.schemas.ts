import { z } from "zod";

const shiftStatusSchema = z.enum(["SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"]);

export const listShiftsQuerySchema = z.object({
  customerId: z.string().min(1).optional(),
  venueId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  status: shiftStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createShiftSchema = z.object({
  customerId: z.string().min(1).optional(),
  venueId: z.string().min(1),
  departmentId: z.string().min(1),
  name: z.string().min(2),
  timezone: z.string().min(2),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  status: shiftStatusSchema.default("SCHEDULED"),
});

export const updateShiftSchema = createShiftSchema.partial();

export const startShiftSchema = z.object({
  customerId: z.string().min(1).optional(),
  startedAt: z.coerce.date().optional(),
});

export const endShiftSchema = z.object({
  customerId: z.string().min(1).optional(),
  endedAt: z.coerce.date().optional(),
});

export const createShiftAssignmentSchema = z.object({
  staffMemberId: z.string().min(1),
  role: z.string().min(1),
  eligibleForTips: z.boolean().default(true),
});

export const updateShiftAssignmentSchema = createShiftAssignmentSchema.partial();

export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
export type CreateShiftAssignmentInput = z.infer<typeof createShiftAssignmentSchema>;
export type UpdateShiftAssignmentInput = z.infer<typeof updateShiftAssignmentSchema>;
export type StartShiftInput = z.infer<typeof startShiftSchema>;
export type EndShiftInput = z.infer<typeof endShiftSchema>;
