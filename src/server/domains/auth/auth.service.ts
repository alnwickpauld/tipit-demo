import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "../../../lib/prisma";
import { AuthenticationError } from "../../shared/errors/app-error";
import { verifyPassword } from "../../shared/auth/password";
import { createSessionToken, verifySessionToken } from "../../shared/auth/session";
import type { AuthenticatedUser } from "../../shared/auth/types";
import type { LoginInput } from "./auth.schemas";

type AuthPrisma = Pick<PrismaClient, "user">;
type AuthenticatedUserRecord = Prisma.UserGetPayload<{
  include: {
    platformRole: true;
    customerUser: {
      include: {
        role: true;
        customer: true;
      };
    };
  };
}>;

export class AuthService {
  constructor(private readonly db: AuthPrisma = prisma) {}

  async login(input: LoginInput) {
    const user = await this.db.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        platformRole: true,
        customerUser: {
          include: {
            role: true,
            customer: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new AuthenticationError("Invalid email or password");
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new AuthenticationError("Invalid email or password");
    }

    const authenticatedUser = this.toAuthenticatedUser(user);
    return {
      user: authenticatedUser,
      token: createSessionToken({
        sub: authenticatedUser.userId,
        role: authenticatedUser.role,
        customerId: authenticatedUser.customerId,
        customerUserId: authenticatedUser.customerUserId,
      }),
    };
  }

  async getCurrentUser(token: string) {
    const payload = verifySessionToken(token);

    const user = await this.db.user.findUnique({
      where: { id: payload.sub },
      include: {
        platformRole: true,
        customerUser: {
          include: {
            role: true,
            customer: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new AuthenticationError("Session is no longer valid");
    }

    return this.toAuthenticatedUser(user);
  }

  private toAuthenticatedUser(user: AuthenticatedUserRecord | null) {
    if (!user) {
      throw new AuthenticationError("Authentication required");
    }

    if (user.platformRole?.code === "TIPIT_ADMIN") {
      return {
        userId: user.id,
        customerUserId: null,
        customerId: null,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: "TIPIT_ADMIN",
        scope: "TIPIT_ADMIN",
      } satisfies AuthenticatedUser;
    }

    const membership = user.customerUser;
    if (!membership || !membership.isActive || membership.customer.status !== "ACTIVE") {
      throw new AuthenticationError("Customer access is not active");
    }

    return {
      userId: user.id,
      customerUserId: membership.id,
      customerId: membership.customerId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: membership.role.code,
      scope: "CUSTOMER_ADMIN",
    } satisfies AuthenticatedUser;
  }
}
