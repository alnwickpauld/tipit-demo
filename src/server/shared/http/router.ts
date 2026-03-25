import type { NextRequest } from "next/server";

import { NotFoundError } from "../errors/app-error";
import { toErrorResponse } from "../errors/error-handler";
import type { ApiContext, RouteDefinition, RouteParams } from "./types";

type MatchResult = {
  route: RouteDefinition;
  params: RouteParams;
};

function matchRoute(
  method: string,
  pathname: string,
  routes: RouteDefinition[],
): MatchResult | null {
  const pathSegments = pathname.split("/").filter(Boolean);

  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }

    const routeSegments = route.path.split("/").filter(Boolean);
    if (routeSegments.length !== pathSegments.length) {
      continue;
    }

    const params: RouteParams = {};
    let isMatch = true;

    routeSegments.forEach((segment, index) => {
      const candidate = pathSegments[index];
      if (!candidate) {
        isMatch = false;
        return;
      }

      if (segment.startsWith(":")) {
        params[segment.slice(1)] = candidate;
        return;
      }

      if (segment !== candidate) {
        isMatch = false;
      }
    });

    if (isMatch) {
      return { route, params };
    }
  }

  return null;
}

function compose(route: RouteDefinition, context: ApiContext): Promise<Response> {
  const middlewares = route.middlewares ?? [];

  const invoke = (index: number): Promise<Response> => {
    const middleware = middlewares[index];
    if (!middleware) {
      return route.handler(context);
    }

    return middleware(context, () => invoke(index + 1));
  };

  return invoke(0);
}

export function createApiRouter(routes: RouteDefinition[]) {
  return async function handle(request: NextRequest, pathname: string) {
    try {
      const matched = matchRoute(request.method, pathname, routes);
      if (!matched) {
        throw new NotFoundError(`No route registered for ${request.method} ${pathname}`);
      }

      const context: ApiContext = {
        request,
        params: matched.params,
        user: null,
      };

      return await compose(matched.route, context);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
