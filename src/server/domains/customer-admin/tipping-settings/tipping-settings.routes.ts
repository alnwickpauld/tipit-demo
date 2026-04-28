import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  getTippingSettingsController,
  updateDepartmentTippingSettingController,
  updateServiceAreaTippingSettingController,
} from "./tipping-settings.controller";

const customerReadOnly = [requireAuth, requirePermission("customer:read")];
const customerManage = [requireAuth, requirePermission("customer:manage")];

export const tippingSettingsRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/customer-admin/tipping-settings",
    middlewares: customerReadOnly,
    handler: getTippingSettingsController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/tipping-settings/revenue-centres/:revenueCentreType",
    middlewares: customerManage,
    handler: updateDepartmentTippingSettingController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/tipping-settings/service-areas/:serviceAreaId",
    middlewares: customerManage,
    handler: updateServiceAreaTippingSettingController,
  },
];
