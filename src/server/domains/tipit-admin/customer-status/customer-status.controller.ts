import type { ApiHandler } from "../../../shared/http/types";
import { ok } from "../../../shared/http/response";
import { parseJsonBody } from "../../../shared/validation/request";
import { updateCustomerStatusSchema } from "./customer-status.schemas";
import { CustomerStatusService } from "./customer-status.service";

const service = new CustomerStatusService();

export const listCustomerStatusController: ApiHandler = async () => {
  return ok(await service.list());
};

export const updateCustomerStatusController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, updateCustomerStatusSchema);
  return ok(await service.update(context.params.customerId, payload.status));
};
