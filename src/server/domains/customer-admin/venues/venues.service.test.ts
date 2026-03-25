import assert from "node:assert/strict";
import test from "node:test";

import { NotFoundError } from "../../../shared/errors/app-error";
import { VenuesService } from "./venues.service";

test("venue list always filters by customerId", async () => {
  let receivedWhere: unknown;

  const service = new VenuesService({
    venue: {
      findMany: async (args: unknown) => {
        receivedWhere = (args as { where: unknown }).where;
        return [];
      },
      count: async () => 0,
      create: async () => ({ id: "venue-1" }),
      findFirst: async () => null,
      update: async () => ({ id: "venue-1" }),
    },
  } as never);

  await service.list({
    customerId: "customer-123",
    page: 1,
    pageSize: 20,
  });

  assert.deepEqual(receivedWhere, { customerId: "customer-123", name: undefined });
});

test("venue update blocks cross-tenant access", async () => {
  const service = new VenuesService({
    venue: {
      findMany: async () => [],
      count: async () => 0,
      create: async () => ({ id: "venue-1" }),
      findFirst: async ({ where }: { where: { id: string; customerId: string } }) => {
        assert.deepEqual(where, { id: "venue-1", customerId: "customer-123" });
        return null;
      },
      update: async () => ({ id: "venue-1" }),
    },
  } as never);

  await assert.rejects(
    () => service.update("customer-123", "venue-1", { name: "Updated" }),
    NotFoundError,
  );
});
