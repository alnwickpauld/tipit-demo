import { createHmac, timingSafeEqual } from "node:crypto";

import { AuthenticationError } from "../errors/app-error";
import type { ApiRole } from "./types";

export const SESSION_COOKIE_NAME = "tipit_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

type SessionTokenPayload = {
  sub: string;
  role: ApiRole;
  customerId: string | null;
  customerUserId: string | null;
  exp: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSessionSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "tipit-local-dev-secret";
  if (!secret) {
    throw new AuthenticationError("AUTH_SECRET is not configured");
  }

  return secret;
}

function sign(input: string) {
  return createHmac("sha256", getSessionSecret()).update(input).digest("base64url");
}

export function createSessionToken(payload: Omit<SessionTokenPayload, "exp">) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    } satisfies SessionTokenPayload),
  );

  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function verifySessionToken(token: string): SessionTokenPayload {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) {
    throw new AuthenticationError("Invalid session token");
  }

  const expected = sign(`${header}.${body}`);
  const provided = Buffer.from(signature, "utf8");
  const actual = Buffer.from(expected, "utf8");

  if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) {
    throw new AuthenticationError("Invalid session token");
  }

  const payload = JSON.parse(base64UrlDecode(body)) as SessionTokenPayload;
  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new AuthenticationError("Session expired");
  }

  return payload;
}

export function getSessionTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const sessionCookie = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!sessionCookie) {
    return null;
  }

  return decodeURIComponent(sessionCookie.slice(`${SESSION_COOKIE_NAME}=`.length));
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
