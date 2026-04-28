import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  exportPoolDistributionRowsController,
  getPoolDistributionEligibleEmployeesController,
  lockPoolDistributionController,
  previewPoolDistributionController,
  savePoolDistributionHoursController,
  unlockPoolDistributionController,
} from "./pool-distributions.controller";

const customerReadOnly = [requireAuth, requirePermission("customer:read")];
const customerOperations = [requireAuth, requirePermission("customer:operations:manage")];

export const poolDistributionsRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/customer-admin/pool-distributions/eligible-employees",
    middlewares: customerReadOnly,
    handler: getPoolDistributionEligibleEmployeesController,
  },
  {
    method: "POST",
    path: "/customer-admin/pool-distributions/hours",
    middlewares: customerOperations,
    handler: savePoolDistributionHoursController,
  },
  {
    method: "POST",
    path: "/customer-admin/pool-distributions/preview",
    middlewares: customerReadOnly,
    handler: previewPoolDistributionController,
  },
  {
    method: "POST",
    path: "/customer-admin/pool-distributions/lock",
    middlewares: customerOperations,
    handler: lockPoolDistributionController,
  },
  {
    method: "POST",
    path: "/customer-admin/pool-distributions/:runId/unlock",
    middlewares: customerOperations,
    handler: unlockPoolDistributionController,
  },
  {
    method: "GET",
    path: "/customer-admin/pool-distributions/export-rows",
    middlewares: customerReadOnly,
    handler: exportPoolDistributionRowsController,
  },
];
