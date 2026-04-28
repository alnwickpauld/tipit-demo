import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  createTipOutPostingController,
  createTipOutRuleController,
  deleteTipOutRuleController,
  listTipOutRulesController,
  previewTipOutController,
  previewTipOutPayrollDistributionController,
  saveManualTipOutHoursController,
  updateTipOutRuleController,
} from "./tip-out-rules.controller";

const customerReadOnly = [requireAuth, requirePermission("customer:read")];
const customerOperations = [requireAuth, requirePermission("customer:operations:manage")];

export const tipOutRulesRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/customer-admin/tip-out-rules",
    middlewares: customerReadOnly,
    handler: listTipOutRulesController,
  },
  {
    method: "POST",
    path: "/customer-admin/tip-out-rules",
    middlewares: customerOperations,
    handler: createTipOutRuleController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/tip-out-rules/:tipOutRuleId",
    middlewares: customerOperations,
    handler: updateTipOutRuleController,
  },
  {
    method: "DELETE",
    path: "/customer-admin/tip-out-rules/:tipOutRuleId",
    middlewares: customerOperations,
    handler: deleteTipOutRuleController,
  },
  {
    method: "POST",
    path: "/customer-admin/tip-out-rules/preview",
    middlewares: customerReadOnly,
    handler: previewTipOutController,
  },
  {
    method: "POST",
    path: "/customer-admin/tip-out-rules/postings",
    middlewares: customerOperations,
    handler: createTipOutPostingController,
  },
  {
    method: "POST",
    path: "/customer-admin/tip-out-rules/payroll-distribution-preview",
    middlewares: customerReadOnly,
    handler: previewTipOutPayrollDistributionController,
  },
  {
    method: "POST",
    path: "/customer-admin/tip-out-rules/manual-hours",
    middlewares: customerOperations,
    handler: saveManualTipOutHoursController,
  },
];
