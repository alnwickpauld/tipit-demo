import { NextResponse } from "next/server";

import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "../../shared/auth/session";
import { requireAuth } from "../../shared/auth/auth-middleware";
import { ok } from "../../shared/http/response";
import type { ApiHandler } from "../../shared/http/types";
import { parseJsonBody } from "../../shared/validation/request";
import { AuthService } from "./auth.service";
import { loginSchema } from "./auth.schemas";

const service = new AuthService();

export const loginController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, loginSchema);
  const session = await service.login(payload);

  const response = NextResponse.json({
    data: {
      user: session.user,
      token: session.token,
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, session.token, getSessionCookieOptions());
  return response;
};

export const currentUserController: ApiHandler = async (context) => {
  return ok(context.user);
};

export const logoutController: ApiHandler = async () => {
  const response = NextResponse.json({
    data: {
      success: true,
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });

  return response;
};

export const currentUserMiddlewares = [requireAuth];
