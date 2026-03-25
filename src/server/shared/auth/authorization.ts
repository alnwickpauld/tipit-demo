import { AuthorizationError, ValidationAppError } from "../errors/app-error";
import type { ApiMiddleware } from "../http/types";
import type { ApiRole, AuthenticatedUser } from "./types";

export type Permission =
  | "platform:manage"
  | "customer:read"
  | "customer:manage"
  | "customer:operations:manage"
  | "customer:billing:manage";

const permissionMatrix: Record<Permission, ApiRole[]> = {
  "platform:manage": ["TIPIT_ADMIN"],
  "customer:read": [
    "TIPIT_ADMIN",
    "CUSTOMER_ADMIN",
    "CUSTOMER_MANAGER",
    "CUSTOMER_VIEWER",
  ],
  "customer:manage": ["TIPIT_ADMIN", "CUSTOMER_ADMIN"],
  "customer:operations:manage": ["TIPIT_ADMIN", "CUSTOMER_ADMIN", "CUSTOMER_MANAGER"],
  "customer:billing:manage": ["TIPIT_ADMIN", "CUSTOMER_ADMIN"],
};

export function hasPermission(user: AuthenticatedUser, permission: Permission) {
  return permissionMatrix[permission].includes(user.role);
}

export function assertPermission(user: AuthenticatedUser | null, permission: Permission) {
  if (!user || !hasPermission(user, permission)) {
    throw new AuthorizationError();
  }
}

export function requirePermission(permission: Permission): ApiMiddleware {
  return async (context, next) => {
    assertPermission(context.user, permission);
    return next();
  };
}

export function requireCustomerScope(user: AuthenticatedUser | null) {
  if (!user) {
    throw new AuthorizationError();
  }

  if (user.role === "TIPIT_ADMIN") {
    throw new AuthorizationError("A customer-scoped session is required for this action");
  }

  if (!user.customerId) {
    throw new AuthorizationError("Customer scope is missing for this session");
  }

  return user.customerId;
}

export function assertTenantAccess(
  user: AuthenticatedUser | null,
  resourceCustomerId: string,
) {
  if (!user) {
    throw new AuthorizationError();
  }

  if (user.role === "TIPIT_ADMIN") {
    return;
  }

  if (!user.customerId || user.customerId !== resourceCustomerId) {
    throw new AuthorizationError("You cannot access data for another customer");
  }
}

export function resolveCustomerContext(
  user: AuthenticatedUser | null,
  requestedCustomerId?: string,
  options?: {
    requireForTipitAdmin?: boolean;
  },
) {
  if (!user) {
    throw new AuthorizationError();
  }

  if (user.role === "TIPIT_ADMIN") {
    if (options?.requireForTipitAdmin && !requestedCustomerId) {
      throw new ValidationAppError("customerId is required for this action");
    }

    return requestedCustomerId;
  }

  if (!user.customerId) {
    throw new AuthorizationError("Customer scope is missing for this session");
  }

  if (requestedCustomerId && requestedCustomerId !== user.customerId) {
    throw new AuthorizationError("You cannot access data for another customer");
  }

  return user.customerId;
}
