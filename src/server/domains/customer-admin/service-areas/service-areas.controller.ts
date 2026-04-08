import { resolveCustomerContext } from "../../../shared/auth/authorization";
import { AuthorizationError } from "../../../shared/errors/app-error";
import { ok } from "../../../shared/http/response";
import type { ApiHandler } from "../../../shared/http/types";
import { parseJsonBody, parseSearchParams } from "../../../shared/validation/request";
import {
  createServiceAreaSchema,
  listServiceAreasQuerySchema,
  updateServiceAreaSchema,
} from "./service-areas.schemas";
import { ServiceAreasService } from "./service-areas.service";

const service = new ServiceAreasService();

function requireCustomerIdForWrite(
  user: NonNullable<Parameters<ApiHandler>[0]["user"]>,
  requestedCustomerId?: string,
) {
  const customerId = resolveCustomerContext(user, requestedCustomerId, {
    requireForTipitAdmin: true,
  });

  return customerId!;
}

export const listServiceAreasController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const query = parseSearchParams(context, listServiceAreasQuerySchema);

  return ok(
    await service.list({
      ...query,
      customerId: resolveCustomerContext(context.user, query.customerId),
    }),
  );
};

export const getServiceAreaByIdController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.getById(
      context.params.serviceAreaId,
      resolveCustomerContext(context.user, requestedCustomerId),
    ),
  );
};

export const createServiceAreaController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, createServiceAreaSchema);

  return ok(
    await service.create(requireCustomerIdForWrite(context.user, payload.customerId), payload),
    201,
  );
};

export const updateServiceAreaController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, updateServiceAreaSchema);

  return ok(
    await service.update(
      requireCustomerIdForWrite(context.user, payload.customerId),
      context.params.serviceAreaId,
      payload,
    ),
  );
};

export const deleteServiceAreaController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.remove(
      requireCustomerIdForWrite(context.user, requestedCustomerId),
      context.params.serviceAreaId,
    ),
  );
};
