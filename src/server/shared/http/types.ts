import { NextRequest } from "next/server";

import type { AuthenticatedUser } from "../auth/types";

export type RouteParams = Record<string, string>;

export type ApiContext = {
  request: NextRequest;
  params: RouteParams;
  user: AuthenticatedUser | null;
};

export type ApiMiddleware = (
  context: ApiContext,
  next: () => Promise<Response>,
) => Promise<Response>;

export type ApiHandler = (context: ApiContext) => Promise<Response>;

export type RouteDefinition = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  middlewares?: ApiMiddleware[];
  handler: ApiHandler;
};
