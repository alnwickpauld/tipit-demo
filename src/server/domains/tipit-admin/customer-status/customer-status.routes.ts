import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  listCustomerStatusController,
  updateCustomerStatusController,
} from "./customer-status.controller";

const tipitAdminOnly = [requireAuth, requirePermission("platform:manage")];

export const customerStatusRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/tipit-admin/customer-status",
    middlewares: tipitAdminOnly,
    handler: listCustomerStatusController,
  },
  {
    method: "PATCH",
    path: "/tipit-admin/customer-status/:customerId",
    middlewares: tipitAdminOnly,
    handler: updateCustomerStatusController,
  },
];
