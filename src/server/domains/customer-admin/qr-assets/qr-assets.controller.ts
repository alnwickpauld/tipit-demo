import { resolveCustomerContext } from "../../../shared/auth/authorization";
import { AuthorizationError } from "../../../shared/errors/app-error";
import { ok } from "../../../shared/http/response";
import type { ApiHandler } from "../../../shared/http/types";
import { parseJsonBody, parseSearchParams } from "../../../shared/validation/request";
import {
  createQrAssetSchema,
  listQrAssetsQuerySchema,
  updateQrAssetSchema,
} from "./qr-assets.schemas";
import { QrAssetsService } from "./qr-assets.service";

const service = new QrAssetsService();

function requireCustomerIdForWrite(
  user: NonNullable<Parameters<ApiHandler>[0]["user"]>,
  requestedCustomerId?: string,
) {
  return resolveCustomerContext(user, requestedCustomerId, {
    requireForTipitAdmin: true,
  })!;
}

export const listQrAssetsController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const query = parseSearchParams(context, listQrAssetsQuerySchema);

  return ok(
    await service.list({
      ...query,
      customerId: resolveCustomerContext(context.user, query.customerId),
    }),
  );
};

export const getQrAssetByIdController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.getById(
      context.params.qrAssetId,
      resolveCustomerContext(context.user, requestedCustomerId),
    ),
  );
};

export const createQrAssetController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, createQrAssetSchema);
  return ok(await service.create(requireCustomerIdForWrite(context.user, payload.customerId), payload), 201);
};

export const updateQrAssetController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, updateQrAssetSchema);
  return ok(
    await service.update(
      requireCustomerIdForWrite(context.user, payload.customerId),
      context.params.qrAssetId,
      payload,
    ),
  );
};

export const deleteQrAssetController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;
  return ok(
    await service.remove(
      requireCustomerIdForWrite(context.user, requestedCustomerId),
      context.params.qrAssetId,
    ),
  );
};
