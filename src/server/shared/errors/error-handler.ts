import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logger, toLoggableError } from "../../../lib/logger";
import { AppError, ValidationAppError } from "./app-error";

export function toErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    const validationError = new ValidationAppError("Validation failed", error.flatten());
    logger.warn("Validation error", {
      code: validationError.code,
      details: validationError.details,
    });
    return NextResponse.json(
      {
        error: validationError.code,
        message: validationError.message,
        details: validationError.details,
      },
      { status: validationError.statusCode },
    );
  }

  if (error instanceof AppError) {
    logger.warn("Application error", {
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    });
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
        details: error.details,
      },
      { status: error.statusCode },
    );
  }

  logger.error("Unhandled server error", {
    error: toLoggableError(error),
  });

  return NextResponse.json(
    {
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    },
    { status: 500 },
  );
}
