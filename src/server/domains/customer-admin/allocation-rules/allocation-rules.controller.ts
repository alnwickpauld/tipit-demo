import { requireCustomerScope } from "../../../shared/auth/authorization";
import { ok } from "../../../shared/http/response";
import type { ApiHandler } from "../../../shared/http/types";
import { parseJsonBody, parseSearchParams } from "../../../shared/validation/request";
import {
  createAllocationRuleFromTemplateSchema,
  createAllocationRuleSchema,
  listAllocationRuleTemplatesQuerySchema,
  updateAllocationRuleSchema,
} from "./allocation-rules.schemas";
import { AllocationRulesService } from "./allocation-rules.service";

const service = new AllocationRulesService();

export const listAllocationRulesController: ApiHandler = async (context) => {
  return ok(await service.list(requireCustomerScope(context.user)));
};

export const listAllocationRuleTemplatesController: ApiHandler = async (context) => {
  const query = parseSearchParams(context, listAllocationRuleTemplatesQuerySchema);
  return ok(await service.listTemplates(query));
};

export const createAllocationRuleController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, createAllocationRuleSchema);
  return ok(await service.create(requireCustomerScope(context.user), payload), 201);
};

export const createAllocationRuleFromTemplateController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, createAllocationRuleFromTemplateSchema);
  return ok(await service.createFromTemplate(requireCustomerScope(context.user), payload), 201);
};

export const updateAllocationRuleController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, updateAllocationRuleSchema);
  return ok(await service.update(requireCustomerScope(context.user), context.params.ruleId, payload));
};
