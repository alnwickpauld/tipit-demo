import type { ApiHandler } from "../../../shared/http/types";
import { ok } from "../../../shared/http/response";
import { parseJsonBody } from "../../../shared/validation/request";
import {
  createCustomerUserSchema,
  updateCustomerUserStatusSchema,
} from "./customer-users.schemas";
import { CustomerUsersService } from "./customer-users.service";

const service = new CustomerUsersService();

export const listCustomerUsersController: ApiHandler = async (context) => {
  return ok(await service.list(context.params.customerId));
};

export const createCustomerUserController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, createCustomerUserSchema);
  return ok(await service.create(context.params.customerId, payload), 201);
};

export const updateCustomerUserStatusController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, updateCustomerUserStatusSchema);
  return ok(
    await service.updateStatus(context.params.customerId, context.params.customerUserId, payload.isActive),
  );
};
