import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  createQrAssetController,
  deleteQrAssetController,
  getQrAssetByIdController,
  listQrAssetsController,
  updateQrAssetController,
} from "./qr-assets.controller";

const customerReadOnly = [requireAuth, requirePermission("customer:read")];
const customerManage = [requireAuth, requirePermission("customer:manage")];

export const qrAssetsRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/customer-admin/qr-assets",
    middlewares: customerReadOnly,
    handler: listQrAssetsController,
  },
  {
    method: "GET",
    path: "/customer-admin/qr-assets/:qrAssetId",
    middlewares: customerReadOnly,
    handler: getQrAssetByIdController,
  },
  {
    method: "POST",
    path: "/customer-admin/qr-assets",
    middlewares: customerManage,
    handler: createQrAssetController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/qr-assets/:qrAssetId",
    middlewares: customerManage,
    handler: updateQrAssetController,
  },
  {
    method: "DELETE",
    path: "/customer-admin/qr-assets/:qrAssetId",
    middlewares: customerManage,
    handler: deleteQrAssetController,
  },
];
