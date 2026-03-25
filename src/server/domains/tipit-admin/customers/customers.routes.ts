import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  createCustomerController,
  getCustomerByIdController,
  listCustomersController,
  updateCustomerController,
  updateCustomerStatusController,
} from "./customers.controller";

const tipitAdminOnly = [requireAuth, requirePermission("platform:manage")];

/**
 * @openapi
 * /api/v1/tipit-admin/customers:
 *   get:
 *     summary: List hospitality groups
 *     tags: [Tipit Admin Customers]
 *   post:
 *     summary: Create a hospitality group
 *     tags: [Tipit Admin Customers]
 * /api/v1/tipit-admin/customers/{customerId}:
 *   get:
 *     summary: Get a hospitality group by id
 *     tags: [Tipit Admin Customers]
 *   patch:
 *     summary: Update a hospitality group and its payroll settings
 *     tags: [Tipit Admin Customers]
 * /api/v1/tipit-admin/customers/{customerId}/status:
 *   patch:
 *     summary: Suspend or deactivate a hospitality group
 *     tags: [Tipit Admin Customers]
 */
export const customersRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/tipit-admin/customers",
    middlewares: tipitAdminOnly,
    handler: listCustomersController,
  },
  {
    method: "POST",
    path: "/tipit-admin/customers",
    middlewares: tipitAdminOnly,
    handler: createCustomerController,
  },
  {
    method: "GET",
    path: "/tipit-admin/customers/:customerId",
    middlewares: tipitAdminOnly,
    handler: getCustomerByIdController,
  },
  {
    method: "PATCH",
    path: "/tipit-admin/customers/:customerId",
    middlewares: tipitAdminOnly,
    handler: updateCustomerController,
  },
  {
    method: "PATCH",
    path: "/tipit-admin/customers/:customerId/status",
    middlewares: tipitAdminOnly,
    handler: updateCustomerStatusController,
  },
];
