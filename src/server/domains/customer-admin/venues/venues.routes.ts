import { requireAuth } from "../../../shared/auth/auth-middleware";
import { requirePermission } from "../../../shared/auth/authorization";
import type { RouteDefinition } from "../../../shared/http/types";
import {
  createVenueController,
  deleteVenueController,
  getVenueByIdController,
  listVenuesController,
  updateVenueController,
  updateVenueStatusController,
} from "./venues.controller";

const customerReadOnly = [requireAuth, requirePermission("customer:read")];
const customerOperations = [requireAuth, requirePermission("customer:operations:manage")];

export const venuesRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/customer-admin/venues",
    middlewares: customerReadOnly,
    handler: listVenuesController,
  },
  {
    method: "GET",
    path: "/customer-admin/venues/:venueId",
    middlewares: customerReadOnly,
    handler: getVenueByIdController,
  },
  {
    method: "POST",
    path: "/customer-admin/venues",
    middlewares: customerOperations,
    handler: createVenueController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/venues/:venueId",
    middlewares: customerOperations,
    handler: updateVenueController,
  },
  {
    method: "PATCH",
    path: "/customer-admin/venues/:venueId/status",
    middlewares: customerOperations,
    handler: updateVenueStatusController,
  },
  {
    method: "DELETE",
    path: "/customer-admin/venues/:venueId",
    middlewares: customerOperations,
    handler: deleteVenueController,
  },
];
