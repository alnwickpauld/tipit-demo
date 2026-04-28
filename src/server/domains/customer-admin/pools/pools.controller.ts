import { requireCustomerScope } from "../../../shared/auth/authorization";
import { ok } from "../../../shared/http/response";
import type { ApiHandler } from "../../../shared/http/types";
import { parseJsonBody, parseSearchParams } from "../../../shared/validation/request";
import {
  createPoolSchema,
  listPoolsQuerySchema,
  previewPoolDistributionSchema,
  updatePoolSchema,
} from "./pools.schemas";
import { PoolsService } from "./pools.service";

const service = new PoolsService();

export const listPoolsController: ApiHandler = async (context) => {
  const query = parseSearchParams(context, listPoolsQuerySchema);
  return ok(await service.list(requireCustomerScope(context.user), query));
};

export const createPoolController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, createPoolSchema);
  return ok(await service.create(requireCustomerScope(context.user), payload), 201);
};

export const updatePoolController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, updatePoolSchema);
  return ok(await service.update(requireCustomerScope(context.user), context.params.poolId, payload));
};

export const previewPoolDistributionController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, previewPoolDistributionSchema);
  return ok(
    await service.previewDistribution(requireCustomerScope(context.user), context.params.poolId, payload),
  );
};

export const deletePoolController: ApiHandler = async (context) => {
  return ok(await service.remove(requireCustomerScope(context.user), context.params.poolId));
};
