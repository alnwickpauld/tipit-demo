import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  createCustomerUserController,
  listCustomerUsersController,
  updateCustomerUserStatusController,
} from "./customer-users.controller";

const tipitAdminOnly = [requireAuth, requirePermission("platform:manage")];

/**
 * @openapi
 * /api/v1/tipit-admin/customers/{customerId}/users:
 *   get:
 *     summary: List admin users for a hospitality group
 *     tags: [Tipit Admin Customer Users]
 *   post:
 *     summary: Create a customer admin user linked to one hospitality group
 *     tags: [Tipit Admin Customer Users]
 * /api/v1/tipit-admin/customers/{customerId}/users/{customerUserId}/status:
 *   patch:
 *     summary: Activate or deactivate a customer user
 *     tags: [Tipit Admin Customer Users]
 */
export const customerUsersRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/tipit-admin/customers/:customerId/users",
    middlewares: tipitAdminOnly,
    handler: listCustomerUsersController,
  },
  {
    method: "POST",
    path: "/tipit-admin/customers/:customerId/users",
    middlewares: tipitAdminOnly,
    handler: createCustomerUserController,
  },
  {
    method: "PATCH",
    path: "/tipit-admin/customers/:customerId/users/:customerUserId/status",
    middlewares: tipitAdminOnly,
    handler: updateCustomerUserStatusController,
  },
];
