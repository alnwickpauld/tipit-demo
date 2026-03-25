import assert from "node:assert/strict";
import test from "node:test";

import { NotFoundError } from "../../../shared/errors/app-error";
import { CustomerUsersService } from "./customer-users.service";

test("create customer user hashes the password and links the membership to the requested customer", async () => {
  const calls: Array<{ step: string; data?: unknown }> = [];

  const service = new CustomerUsersService(
    {
      customer: {
        findUnique: async () => ({ id: "customer-1" }),
      },
      role: {
        findUnique: async () => ({ id: "role-1" }),
      },
      user: {
        update: async () => ({}),
      },
      customerUser: {
        findMany: async () => [],
        findFirst: async () => null,
        findUniqueOrThrow: async () => ({}),
        update: async () => ({}),
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          user: {
            create: async ({ data }: { data: unknown }) => {
              calls.push({ step: "tx.user.create", data });
              return { id: "user-1" };
            },
          },
          customerUser: {
            create: async ({ data }: { data: unknown }) => {
              calls.push({ step: "tx.customerUser.create", data });
              return { id: "customer-user-1" };
            },
          },
        }),
    } as never,
    async (password) => `hashed:${password}`,
  );

  await service.create("customer-1", {
    email: "ops@sharkclub.example",
    firstName: "Jordan",
    lastName: "Reeves",
    password: "Password123!",
    role: "CUSTOMER_MANAGER",
  });

  assert.deepEqual(calls, [
    {
      step: "tx.user.create",
      data: {
        email: "ops@sharkclub.example",
        passwordHash: "hashed:Password123!",
        firstName: "Jordan",
        lastName: "Reeves",
      },
    },
    {
      step: "tx.customerUser.create",
      data: {
        customerId: "customer-1",
        userId: "user-1",
        roleId: "role-1",
      },
    },
  ]);
});

test("customer user status update cannot cross customer boundaries", async () => {
  const service = new CustomerUsersService(
    {
      customer: {
        findUnique: async () => ({ id: "customer-1" }),
      },
      role: {
        findUnique: async () => ({ id: "role-1" }),
      },
      user: {
        update: async () => ({}),
      },
      customerUser: {
        findMany: async () => [],
        findFirst: async () => null,
        findUniqueOrThrow: async () => ({}),
        update: async () => ({}),
      },
      $transaction: async () => ({}),
    } as never,
    async (password) => `hashed:${password}`,
  );

  await assert.rejects(
    () => service.updateStatus("customer-1", "customer-user-1", false),
    NotFoundError,
  );
});
