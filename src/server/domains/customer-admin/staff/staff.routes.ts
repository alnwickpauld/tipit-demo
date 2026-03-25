import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  createStaffController,
  deleteStaffController,
  getStaffMemberByIdController,
  listStaffController,
  updateStaffController,
  updateStaffStatusController,
} from "./staff.controller";

const customerReadOnly = [requireAuth, requirePermission("customer:read")];
const customerOperations = [requireAuth, requirePermission("customer:operations:manage")];

export const staffRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/customer-admin/staff",
    middlewares: customerReadOnly,
    handler: listStaffController,
  },
  {
    method: "GET",
    path: "/customer-admin/staff/:staffMemberId",
    middlewares: customerReadOnly,
    handler: getStaffMemberByIdController,
  },
  {
    method: "POST",
    path: "/customer-admin/staff",
    middlewares: customerOperations,
    handler: createStaffController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/staff/:staffMemberId",
    middlewares: customerOperations,
    handler: updateStaffController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/staff/:staffMemberId/status",
    middlewares: customerOperations,
    handler: updateStaffStatusController,
  },
  {
    method: "DELETE",
    path: "/customer-admin/staff/:staffMemberId",
    middlewares: customerOperations,
    handler: deleteStaffController,
  },
];
