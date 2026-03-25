import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  listFeeSettingsController,
  updateFeeSettingsController,
} from "./fee-settings.controller";

const tipitAdminOnly = [requireAuth, requirePermission("platform:manage")];

export const feeSettingsRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/tipit-admin/fee-settings",
    middlewares: tipitAdminOnly,
    handler: listFeeSettingsController,
  },
  {
    method: "PATCH",
    path: "/tipit-admin/fee-settings/:customerId",
    middlewares: tipitAdminOnly,
    handler: updateFeeSettingsController,
  },
];
