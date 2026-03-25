import { AuthorizationError } from "../errors/app-error";
import type { ApiMiddleware } from "../http/types";
import type { ApiRole } from "./types";

export function requireRoles(allowedRoles: ApiRole[]): ApiMiddleware {
  return async (context, next) => {
    if (!context.user || !allowedRoles.includes(context.user.role)) {
      throw new AuthorizationError();
    }

    return next();
  };
}
