import type { ApiHandler } from "../../../shared/http/types";
import { ok } from "../../../shared/http/response";
import { parseJsonBody } from "../../../shared/validation/request";
import {
  createCustomerSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
} from "./customers.schemas";
import { CustomersService } from "./customers.service";

const service = new CustomersService();

export const listCustomersController: ApiHandler = async () => {
  return ok(await service.list());
};

export const getCustomerByIdController: ApiHandler = async (context) => {
  return ok(await service.getById(context.params.customerId));
};

export const createCustomerController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, createCustomerSchema);
  return ok(await service.create(payload), 201);
};

export const updateCustomerController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, updateCustomerSchema);
  return ok(await service.update(context.params.customerId, payload));
};

export const updateCustomerStatusController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, updateCustomerStatusSchema);
  return ok(await service.updateStatus(context.params.customerId, payload));
};
