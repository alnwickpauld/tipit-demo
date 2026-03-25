import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  createAllocationRuleController,
  listAllocationRulesController,
  updateAllocationRuleController,
} from "./allocation-rules.controller";

const customerReadOnly = [requireAuth, requirePermission("customer:read")];
const customerOperations = [requireAuth, requirePermission("customer:operations:manage")];

export const allocationRulesRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/customer-admin/allocation-rules",
    middlewares: customerReadOnly,
    handler: listAllocationRulesController,
  },
  {
    method: "POST",
    path: "/customer-admin/allocation-rules",
    middlewares: customerOperations,
    handler: createAllocationRuleController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/allocation-rules/:ruleId",
    middlewares: customerOperations,
    handler: updateAllocationRuleController,
  },
];
