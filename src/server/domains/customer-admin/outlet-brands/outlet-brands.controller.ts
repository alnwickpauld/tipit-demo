import { resolveCustomerContext } from "../../../shared/auth/authorization";
import { AuthorizationError } from "../../../shared/errors/app-error";
import { ok } from "../../../shared/http/response";
import type { ApiHandler } from "../../../shared/http/types";
import { parseJsonBody, parseSearchParams } from "../../../shared/validation/request";
import {
  createOutletBrandSchema,
  listOutletBrandsQuerySchema,
  updateOutletBrandSchema,
} from "./outlet-brands.schemas";
import { OutletBrandsService } from "./outlet-brands.service";

const service = new OutletBrandsService();

function requireCustomerIdForWrite(
  user: NonNullable<Parameters<ApiHandler>[0]["user"]>,
  requestedCustomerId?: string,
) {
  const customerId = resolveCustomerContext(user, requestedCustomerId, {
    requireForTipitAdmin: true,
  });

  return customerId!;
}

export const listOutletBrandsController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const query = parseSearchParams(context, listOutletBrandsQuerySchema);

  return ok(
    await service.list({
      ...query,
      customerId: resolveCustomerContext(context.user, query.customerId),
    }),
  );
};

export const getOutletBrandByIdController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.getById(
      context.params.outletBrandId,
      resolveCustomerContext(context.user, requestedCustomerId),
    ),
  );
};

export const createOutletBrandController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, createOutletBrandSchema);

  return ok(
    await service.create(requireCustomerIdForWrite(context.user, payload.customerId), payload),
    201,
  );
};

export const updateOutletBrandController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, updateOutletBrandSchema);

  return ok(
    await service.update(
      requireCustomerIdForWrite(context.user, payload.customerId),
      context.params.outletBrandId,
      payload,
    ),
  );
};

export const deleteOutletBrandController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.remove(
      requireCustomerIdForWrite(context.user, requestedCustomerId),
      context.params.outletBrandId,
    ),
  );
};
