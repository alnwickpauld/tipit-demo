export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly code = "INTERNAL_SERVER_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "AUTHENTICATION_REQUIRED");
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ValidationAppError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}
