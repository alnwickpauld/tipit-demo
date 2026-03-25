import type { RouteDefinition } from "../../shared/http/types";
import {
  currentUserController,
  currentUserMiddlewares,
  loginController,
  logoutController,
} from "./auth.controller";

export const authRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/auth/login",
    handler: loginController,
  },
  {
    method: "POST",
    path: "/auth/logout",
    handler: logoutController,
  },
  {
    method: "GET",
    path: "/auth/me",
    middlewares: currentUserMiddlewares,
    handler: currentUserController,
  },
];
