import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  createAllocationRuleController,
  createAllocationRuleFromTemplateController,
  listAllocationRulesController,
  listAllocationRuleTemplatesController,
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
    method: "GET",
    path: "/customer-admin/allocation-rules/templates",
    middlewares: customerReadOnly,
    handler: listAllocationRuleTemplatesController,
  },
  {
    method: "POST",
    path: "/customer-admin/allocation-rules",
    middlewares: customerOperations,
    handler: createAllocationRuleController,
  },
  {
    method: "POST",
    path: "/customer-admin/allocation-rules/templates/apply",
    middlewares: customerOperations,
    handler: createAllocationRuleFromTemplateController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/allocation-rules/:ruleId",
    middlewares: customerOperations,
    handler: updateAllocationRuleController,
  },
];
