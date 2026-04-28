import { requireCustomerScope } from "../../../shared/auth/authorization";
import { ok } from "../../../shared/http/response";
import type { ApiHandler } from "../../../shared/http/types";
import { parseJsonBody, parseSearchParams } from "../../../shared/validation/request";
import {
  createTipOutPostingSchema,
  createTipOutRuleSchema,
  listTipOutRulesQuerySchema,
  previewTipOutPayrollDistributionSchema,
  previewTipOutSchema,
  saveManualTipOutHoursSchema,
  updateTipOutRuleSchema,
} from "./tip-out-rules.schemas";
import { TipOutRulesService } from "./tip-out-rules.service";

const service = new TipOutRulesService();

export const listTipOutRulesController: ApiHandler = async (context) => {
  const query = parseSearchParams(context, listTipOutRulesQuerySchema);
  return ok(await service.list(requireCustomerScope(context.user), query));
};

export const createTipOutRuleController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, createTipOutRuleSchema);
  return ok(await service.create(requireCustomerScope(context.user), context.user!, payload), 201);
};

export const updateTipOutRuleController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, updateTipOutRuleSchema);
  return ok(
    await service.update(
      requireCustomerScope(context.user),
      context.params.tipOutRuleId,
      context.user!,
      payload,
    ),
  );
};

export const deleteTipOutRuleController: ApiHandler = async (context) => {
  return ok(
    await service.remove(requireCustomerScope(context.user), context.params.tipOutRuleId, context.user!),
  );
};

export const previewTipOutController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, previewTipOutSchema);
  return ok(await service.preview(requireCustomerScope(context.user), payload));
};

export const createTipOutPostingController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, createTipOutPostingSchema);
  return ok(
    await service.createPosting(requireCustomerScope(context.user), context.user!, payload),
    201,
  );
};

export const previewTipOutPayrollDistributionController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, previewTipOutPayrollDistributionSchema);
  return ok(await service.previewPayrollDistribution(requireCustomerScope(context.user), payload));
};

export const saveManualTipOutHoursController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, saveManualTipOutHoursSchema);
  return ok(await service.saveManualHours(requireCustomerScope(context.user), context.user!, payload));
};
