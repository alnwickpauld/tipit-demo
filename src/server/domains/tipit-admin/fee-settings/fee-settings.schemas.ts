import { z } from "zod";

export const updateFeeSettingsSchema = z.object({
  tipitFeeBps: z.number().int().min(0).max(10_000),
});
