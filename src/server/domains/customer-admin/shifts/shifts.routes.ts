import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  createShiftAssignmentController,
  createShiftController,
  deleteShiftAssignmentController,
  deleteShiftController,
  endShiftController,
  getShiftByIdController,
  listShiftsController,
  startShiftController,
  updateShiftAssignmentController,
  updateShiftController,
} from "./shifts.controller";

const customerReadOnly = [requireAuth, requirePermission("customer:read")];
const customerOperations = [requireAuth, requirePermission("customer:operations:manage")];

export const shiftsRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/customer-admin/shifts",
    middlewares: customerReadOnly,
    handler: listShiftsController,
  },
  {
    method: "GET",
    path: "/customer-admin/shifts/:shiftId",
    middlewares: customerReadOnly,
    handler: getShiftByIdController,
  },
  {
    method: "POST",
    path: "/customer-admin/shifts",
    middlewares: customerOperations,
    handler: createShiftController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/shifts/:shiftId",
    middlewares: customerOperations,
    handler: updateShiftController,
  },
  {
    method: "DELETE",
    path: "/customer-admin/shifts/:shiftId",
    middlewares: customerOperations,
    handler: deleteShiftController,
  },
  {
    method: "POST",
    path: "/customer-admin/shifts/:shiftId/start",
    middlewares: customerOperations,
    handler: startShiftController,
  },
  {
    method: "POST",
    path: "/customer-admin/shifts/:shiftId/end",
    middlewares: customerOperations,
    handler: endShiftController,
  },
  {
    method: "POST",
    path: "/customer-admin/shifts/:shiftId/assignments",
    middlewares: customerOperations,
    handler: createShiftAssignmentController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/shifts/:shiftId/assignments/:assignmentId",
    middlewares: customerOperations,
    handler: updateShiftAssignmentController,
  },
  {
    method: "DELETE",
    path: "/customer-admin/shifts/:shiftId/assignments/:assignmentId",
    middlewares: customerOperations,
    handler: deleteShiftAssignmentController,
  },
];
