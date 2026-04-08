import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  createDepartmentController,
  deleteDepartmentController,
  getDepartmentByIdController,
  listDepartmentsController,
  updateDepartmentController,
} from "./departments.controller";

const customerReadOnly = [requireAuth, requirePermission("customer:read")];
const customerOperations = [requireAuth, requirePermission("customer:operations:manage")];

export const departmentsRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/customer-admin/departments",
    middlewares: customerReadOnly,
    handler: listDepartmentsController,
  },
  {
    method: "GET",
    path: "/customer-admin/departments/:departmentId",
    middlewares: customerReadOnly,
    handler: getDepartmentByIdController,
  },
  {
    method: "POST",
    path: "/customer-admin/departments",
    middlewares: customerOperations,
    handler: createDepartmentController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/departments/:departmentId",
    middlewares: customerOperations,
    handler: updateDepartmentController,
  },
  {
    method: "DELETE",
    path: "/customer-admin/departments/:departmentId",
    middlewares: customerOperations,
    handler: deleteDepartmentController,
  },
];
