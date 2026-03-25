import { AuthService } from "../../domains/auth/auth.service";
import { AuthenticationError } from "../errors/app-error";
import type { ApiMiddleware } from "../http/types";
import { getSessionTokenFromRequest } from "./session";

const authService = new AuthService();

export const requireAuth: ApiMiddleware = async (context, next) => {
  const token = getSessionTokenFromRequest(context.request);

  if (!token) {
    throw new AuthenticationError("Authentication required");
  }

  context.user = await authService.getCurrentUser(token);
  return next();
};
