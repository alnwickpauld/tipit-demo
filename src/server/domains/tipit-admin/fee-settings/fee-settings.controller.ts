import type { ApiHandler } from "../../../shared/http/types";
import { ok } from "../../../shared/http/response";
import { parseJsonBody } from "../../../shared/validation/request";
import { updateFeeSettingsSchema } from "./fee-settings.schemas";
import { FeeSettingsService } from "./fee-settings.service";

const service = new FeeSettingsService();

export const listFeeSettingsController: ApiHandler = async () => {
  return ok(await service.list());
};

export const updateFeeSettingsController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, updateFeeSettingsSchema);
  return ok(await service.update(context.params.customerId, payload.tipitFeeBps));
};
