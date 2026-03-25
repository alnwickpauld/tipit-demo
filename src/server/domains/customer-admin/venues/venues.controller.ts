import { AuthorizationError } from "../../../shared/errors/app-error";
import { ok } from "../../../shared/http/response";
import type { ApiHandler } from "../../../shared/http/types";
import { parseJsonBody, parseSearchParams } from "../../../shared/validation/request";
import {
  createVenueSchema,
  listVenuesQuerySchema,
  updateVenueSchema,
  updateVenueStatusSchema,
} from "./venues.schemas";
import { VenuesService } from "./venues.service";

const service = new VenuesService();

function resolveVenueCustomerId(
  user: NonNullable<Parameters<ApiHandler>[0]["user"]>,
  requestedCustomerId?: string,
) {
  if (user.role === "TIPIT_ADMIN") {
    return requestedCustomerId;
  }

  if (!user.customerId) {
    throw new AuthorizationError("Customer scope is missing for this session");
  }

  return user.customerId;
}

export const listVenuesController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const query = parseSearchParams(context, listVenuesQuerySchema);

  return ok(
    await service.list({
      ...query,
      customerId: resolveVenueCustomerId(context.user, query.customerId),
    }),
  );
};

export const getVenueByIdController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.getById(
      context.params.venueId,
      resolveVenueCustomerId(context.user, requestedCustomerId),
    ),
  );
};

export const createVenueController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, createVenueSchema);

  return ok(
    await service.create(
      resolveVenueCustomerId(context.user, payload.customerId),
      payload,
    ),
    201,
  );
};

export const updateVenueController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, updateVenueSchema);
  return ok(
    await service.update(
      resolveVenueCustomerId(context.user, payload.customerId),
      context.params.venueId,
      payload,
    ),
  );
};

export const updateVenueStatusController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, updateVenueStatusSchema);
  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.updateStatus(
      resolveVenueCustomerId(context.user, requestedCustomerId),
      context.params.venueId,
      payload.status,
    ),
  );
};

export const deleteVenueController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.remove(
      resolveVenueCustomerId(context.user, requestedCustomerId),
      context.params.venueId,
    ),
  );
};
