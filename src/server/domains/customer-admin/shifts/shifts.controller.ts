import { resolveCustomerContext } from "../../../shared/auth/authorization";
import { AuthorizationError } from "../../../shared/errors/app-error";
import { ok } from "../../../shared/http/response";
import type { ApiHandler } from "../../../shared/http/types";
import { parseJsonBody, parseSearchParams } from "../../../shared/validation/request";
import {
  createShiftAssignmentSchema,
  createShiftSchema,
  endShiftSchema,
  listShiftsQuerySchema,
  startShiftSchema,
  updateShiftAssignmentSchema,
  updateShiftSchema,
} from "./shifts.schemas";
import { ShiftsService } from "./shifts.service";

const service = new ShiftsService();

function requireCustomerIdForWrite(
  user: NonNullable<Parameters<ApiHandler>[0]["user"]>,
  requestedCustomerId?: string,
) {
  const customerId = resolveCustomerContext(user, requestedCustomerId, {
    requireForTipitAdmin: true,
  });

  return customerId!;
}

export const listShiftsController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const query = parseSearchParams(context, listShiftsQuerySchema);

  return ok(
    await service.list({
      ...query,
      customerId: resolveCustomerContext(context.user, query.customerId),
    }),
  );
};

export const getShiftByIdController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.getById(
      context.params.shiftId,
      resolveCustomerContext(context.user, requestedCustomerId),
    ),
  );
};

export const createShiftController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, createShiftSchema);

  return ok(
    await service.create(requireCustomerIdForWrite(context.user, payload.customerId), payload),
    201,
  );
};

export const updateShiftController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, updateShiftSchema);

  return ok(
    await service.update(
      requireCustomerIdForWrite(context.user, payload.customerId),
      context.params.shiftId,
      payload,
    ),
  );
};

export const deleteShiftController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.remove(
      requireCustomerIdForWrite(context.user, requestedCustomerId),
      context.params.shiftId,
    ),
  );
};

export const startShiftController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, startShiftSchema);

  return ok(
    await service.startShift(
      requireCustomerIdForWrite(context.user, payload.customerId),
      context.params.shiftId,
      context.user,
      payload,
    ),
  );
};

export const endShiftController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, endShiftSchema);

  return ok(
    await service.endShift(
      requireCustomerIdForWrite(context.user, payload.customerId),
      context.params.shiftId,
      context.user,
      payload,
    ),
  );
};

export const createShiftAssignmentController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;
  const payload = await parseJsonBody(context, createShiftAssignmentSchema);

  return ok(
    await service.addAssignment(
      requireCustomerIdForWrite(context.user, requestedCustomerId),
      context.params.shiftId,
      payload,
    ),
  );
};

export const updateShiftAssignmentController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;
  const payload = await parseJsonBody(context, updateShiftAssignmentSchema);

  return ok(
    await service.updateAssignment(
      requireCustomerIdForWrite(context.user, requestedCustomerId),
      context.params.shiftId,
      context.params.assignmentId,
      payload,
    ),
  );
};

export const deleteShiftAssignmentController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.removeAssignment(
      requireCustomerIdForWrite(context.user, requestedCustomerId),
      context.params.shiftId,
      context.params.assignmentId,
    ),
  );
};
