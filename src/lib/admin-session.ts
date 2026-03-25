import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AuthService } from "../server/domains/auth/auth.service";
import { SESSION_COOKIE_NAME } from "../server/shared/auth/session";
import type { AuthenticatedUser } from "../server/shared/auth/types";

const authService = new AuthService();

export async function getSessionUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    return await authService.getCurrentUser(token);
  } catch {
    return null;
  }
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireTipitAdmin() {
  const user = await requireSessionUser();
  if (user.role !== "TIPIT_ADMIN") {
    redirect("/customer-admin");
  }

  return user;
}

export async function requireCustomerUser() {
  const user = await requireSessionUser();
  if (user.role === "TIPIT_ADMIN") {
    redirect("/admin");
  }

  return user;
}

export function getDefaultAdminRoute(user: AuthenticatedUser) {
  return user.role === "TIPIT_ADMIN" ? "/admin" : "/customer-admin";
}
