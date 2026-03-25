import { AuthorizationError } from "../../../shared/errors/app-error";
import { ok } from "../../../shared/http/response";
import type { ApiHandler } from "../../../shared/http/types";
import { resolveCustomerContext } from "../../../shared/auth/authorization";
import { parseJsonBody, parseSearchParams } from "../../../shared/validation/request";
import {
  createStaffSchema,
  listStaffQuerySchema,
  updateStaffSchema,
  updateStaffStatusSchema,
} from "./staff.schemas";
import { StaffService } from "./staff.service";

const service = new StaffService();

export const listStaffController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const query = parseSearchParams(context, listStaffQuerySchema);

  return ok(
    await service.list({
      customerId: resolveCustomerContext(context.user, query.customerId),
      venueId: query.venueId,
    }),
  );
};

export const getStaffMemberByIdController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.getById(
      context.params.staffMemberId,
      resolveCustomerContext(context.user, requestedCustomerId),
    ),
  );
};

export const createStaffController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, createStaffSchema);

  return ok(
    await service.create(
      resolveCustomerContext(context.user, payload.customerId, {
        requireForTipitAdmin: true,
      })!,
      payload,
    ),
    201,
  );
};

export const updateStaffController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, updateStaffSchema);
  return ok(
    await service.update(
      resolveCustomerContext(context.user, payload.customerId),
      context.params.staffMemberId,
      payload,
    ),
  );
};

export const updateStaffStatusController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, updateStaffStatusSchema);
  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.updateStatus(
      resolveCustomerContext(context.user, requestedCustomerId),
      context.params.staffMemberId,
      payload.status,
    ),
  );
};

export const deleteStaffController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.remove(
      resolveCustomerContext(context.user, requestedCustomerId),
      context.params.staffMemberId,
    ),
  );
};
