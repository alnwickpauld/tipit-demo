import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  createServiceAreaController,
  deleteServiceAreaController,
  getServiceAreaByIdController,
  listServiceAreasController,
  updateServiceAreaController,
} from "./service-areas.controller";

const customerReadOnly = [requireAuth, requirePermission("customer:read")];
const customerOperations = [requireAuth, requirePermission("customer:operations:manage")];

export const serviceAreasRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/customer-admin/service-areas",
    middlewares: customerReadOnly,
    handler: listServiceAreasController,
  },
  {
    method: "GET",
    path: "/customer-admin/service-areas/:serviceAreaId",
    middlewares: customerReadOnly,
    handler: getServiceAreaByIdController,
  },
  {
    method: "POST",
    path: "/customer-admin/service-areas",
    middlewares: customerOperations,
    handler: createServiceAreaController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/service-areas/:serviceAreaId",
    middlewares: customerOperations,
    handler: updateServiceAreaController,
  },
  {
    method: "DELETE",
    path: "/customer-admin/service-areas/:serviceAreaId",
    middlewares: customerOperations,
    handler: deleteServiceAreaController,
  },
];
