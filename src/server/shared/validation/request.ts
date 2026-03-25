import { z } from "zod";

import { ValidationAppError } from "../errors/app-error";
import type { ApiContext } from "../http/types";

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  context: ApiContext,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const body = await context.request.json().catch(() => {
    throw new ValidationAppError("Request body must be valid JSON");
  });

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationAppError("Validation failed", result.error.flatten());
  }

  return result.data;
}

export function parseSearchParams<TSchema extends z.ZodTypeAny>(
  context: ApiContext,
  schema: TSchema,
): z.infer<TSchema> {
  const raw = Object.fromEntries(context.request.nextUrl.searchParams.entries());
  const result = schema.safeParse(raw);

  if (!result.success) {
    throw new ValidationAppError("Validation failed", result.error.flatten());
  }

  return result.data;
}
