import type { PrismaClient } from "@prisma/client";

import { prisma } from "../../../../lib/prisma";
import { NotFoundError } from "../../../shared/errors/app-error";
import { hashPassword } from "../../../shared/auth/password";
import type { CreateCustomerUserInput } from "./customer-users.schemas";

export class CustomerUsersService {
  constructor(
    private readonly db: Pick<
      PrismaClient,
      "customer" | "role" | "user" | "customerUser" | "$transaction"
    > = prisma,
    private readonly passwordHasher: typeof hashPassword = hashPassword,
  ) {}

  async list(customerId: string) {
    return this.db.customerUser.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      include: {
        role: {
          select: { id: true, code: true, name: true },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
        customer: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async create(customerId: string, input: CreateCustomerUserInput) {
    const customer = await this.db.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const role = await this.db.role.findUnique({
      where: { code: input.role },
      select: { id: true },
    });

    if (!role) {
      throw new NotFoundError("Role not found");
    }

    return this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: await this.passwordHasher(input.password),
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });

      return tx.customerUser.create({
        data: {
          customerId,
          userId: user.id,
          roleId: role.id,
        },
        include: {
          role: true,
          user: true,
          customer: true,
        },
      });
    });
  }

  async updateStatus(customerId: string, customerUserId: string, isActive: boolean) {
    const membership = await this.db.customerUser.findFirst({
      where: { id: customerUserId, customerId },
      include: {
        role: true,
        user: true,
        customer: true,
      },
    });

    if (!membership) {
      throw new NotFoundError("Customer user not found");
    }

    await this.db.$transaction([
      this.db.customerUser.update({
        where: { id: customerUserId },
        data: { isActive },
      }),
      this.db.user.update({
        where: { id: membership.userId },
        data: { isActive },
      }),
    ]);

    return this.db.customerUser.findUniqueOrThrow({
      where: { id: customerUserId },
      include: {
        role: true,
        user: true,
        customer: true,
      },
    });
  }
}
