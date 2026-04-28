import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  createPoolController,
  deletePoolController,
  listPoolsController,
  previewPoolDistributionController,
  updatePoolController,
} from "./pools.controller";

const customerReadOnly = [requireAuth, requirePermission("customer:read")];
const customerOperations = [requireAuth, requirePermission("customer:operations:manage")];

export const poolsRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/customer-admin/pools",
    middlewares: customerReadOnly,
    handler: listPoolsController,
  },
  {
    method: "POST",
    path: "/customer-admin/pools",
    middlewares: customerOperations,
    handler: createPoolController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/pools/:poolId",
    middlewares: customerOperations,
    handler: updatePoolController,
  },
  {
    method: "POST",
    path: "/customer-admin/pools/:poolId/distribution-preview",
    middlewares: customerReadOnly,
    handler: previewPoolDistributionController,
  },
  {
    method: "DELETE",
    path: "/customer-admin/pools/:poolId",
    middlewares: customerOperations,
    handler: deletePoolController,
  },
];
