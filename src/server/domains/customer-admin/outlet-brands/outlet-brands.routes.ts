import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  createOutletBrandController,
  deleteOutletBrandController,
  getOutletBrandByIdController,
  listOutletBrandsController,
  updateOutletBrandController,
} from "./outlet-brands.controller";

const customerReadOnly = [requireAuth, requirePermission("customer:read")];
const customerOperations = [requireAuth, requirePermission("customer:operations:manage")];

export const outletBrandsRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/customer-admin/outlet-brands",
    middlewares: customerReadOnly,
    handler: listOutletBrandsController,
  },
  {
    method: "GET",
    path: "/customer-admin/outlet-brands/:outletBrandId",
    middlewares: customerReadOnly,
    handler: getOutletBrandByIdController,
  },
  {
    method: "POST",
    path: "/customer-admin/outlet-brands",
    middlewares: customerOperations,
    handler: createOutletBrandController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/outlet-brands/:outletBrandId",
    middlewares: customerOperations,
    handler: updateOutletBrandController,
  },
  {
    method: "DELETE",
    path: "/customer-admin/outlet-brands/:outletBrandId",
    middlewares: customerOperations,
    handler: deleteOutletBrandController,
  },
];
