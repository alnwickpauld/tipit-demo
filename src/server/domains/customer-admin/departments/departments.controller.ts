import { resolveCustomerContext } from "../../../shared/auth/authorization";
import { AuthorizationError } from "../../../shared/errors/app-error";
import { ok } from "../../../shared/http/response";
import type { ApiHandler } from "../../../shared/http/types";
import { parseJsonBody, parseSearchParams } from "../../../shared/validation/request";
import {
  createDepartmentSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from "./departments.schemas";
import { DepartmentsService } from "./departments.service";

const service = new DepartmentsService();

function requireCustomerIdForWrite(
  user: NonNullable<Parameters<ApiHandler>[0]["user"]>,
  requestedCustomerId?: string,
) {
  const customerId = resolveCustomerContext(user, requestedCustomerId, {
    requireForTipitAdmin: true,
  });

  return customerId!;
}

export const listDepartmentsController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const query = parseSearchParams(context, listDepartmentsQuerySchema);

  return ok(
    await service.list({
      ...query,
      customerId: resolveCustomerContext(context.user, query.customerId),
    }),
  );
};

export const getDepartmentByIdController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.getById(
      context.params.departmentId,
      resolveCustomerContext(context.user, requestedCustomerId),
    ),
  );
};

export const createDepartmentController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, createDepartmentSchema);

  return ok(
    await service.create(requireCustomerIdForWrite(context.user, payload.customerId), payload),
    201,
  );
};

export const updateDepartmentController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const payload = await parseJsonBody(context, updateDepartmentSchema);

  return ok(
    await service.update(
      requireCustomerIdForWrite(context.user, payload.customerId),
      context.params.departmentId,
      payload,
    ),
  );
};

export const deleteDepartmentController: ApiHandler = async (context) => {
  if (!context.user) {
    throw new AuthorizationError();
  }

  const requestedCustomerId = context.request.nextUrl.searchParams.get("customerId") ?? undefined;

  return ok(
    await service.remove(
      requireCustomerIdForWrite(context.user, requestedCustomerId),
      context.params.departmentId,
    ),
  );
};
