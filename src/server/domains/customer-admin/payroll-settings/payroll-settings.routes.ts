import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  getPayrollSettingsController,
  updatePayrollSettingsController,
} from "./payroll-settings.controller";

const customerReadOnly = [requireAuth, requirePermission("customer:read")];
const customerBilling = [requireAuth, requirePermission("customer:billing:manage")];

export const payrollSettingsRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/customer-admin/payroll-settings",
    middlewares: customerReadOnly,
    handler: getPayrollSettingsController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/payroll-settings",
    middlewares: customerBilling,
    handler: updatePayrollSettingsController,
  },
];
