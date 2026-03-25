import { requireCustomerScope } from "../../../shared/auth/authorization";
import { ok } from "../../../shared/http/response";
import type { ApiHandler } from "../../../shared/http/types";
import { parseJsonBody } from "../../../shared/validation/request";
import { updatePayrollSettingsSchema } from "./payroll-settings.schemas";
import { PayrollSettingsService } from "./payroll-settings.service";

const service = new PayrollSettingsService();

export const getPayrollSettingsController: ApiHandler = async (context) => {
  return ok(await service.get(requireCustomerScope(context.user)));
};

export const updatePayrollSettingsController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, updatePayrollSettingsSchema);
  return ok(await service.update(requireCustomerScope(context.user), payload));
};
