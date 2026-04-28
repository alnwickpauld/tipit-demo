import { requireCustomerScope } from "../../../shared/auth/authorization";
import { ok } from "../../../shared/http/response";
import type { ApiHandler } from "../../../shared/http/types";
import { parseJsonBody, parseSearchParams } from "../../../shared/validation/request";
import {
  exportPoolDistributionRowsQuerySchema,
  lockPoolDistributionSchema,
  poolDistributionQuerySchema,
  previewPoolDistributionSchema,
  savePoolHoursEntriesSchema,
} from "./pool-distributions.schemas";
import { PoolDistributionsService } from "./pool-distributions.service";

const service = new PoolDistributionsService();

export const getPoolDistributionEligibleEmployeesController: ApiHandler = async (context) => {
  const query = parseSearchParams(context, poolDistributionQuerySchema);
  return ok(await service.getEligibleEmployees(requireCustomerScope(context.user), query));
};

export const savePoolDistributionHoursController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, savePoolHoursEntriesSchema);
  return ok(await service.saveHoursEntries(requireCustomerScope(context.user), context.user!, payload));
};

export const previewPoolDistributionController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, previewPoolDistributionSchema);
  return ok(await service.previewDistribution(requireCustomerScope(context.user), context.user!, payload));
};

export const lockPoolDistributionController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, lockPoolDistributionSchema);
  return ok(await service.lockDistribution(requireCustomerScope(context.user), context.user!, payload));
};

export const unlockPoolDistributionController: ApiHandler = async (context) => {
  return ok(
    await service.unlockDistribution(requireCustomerScope(context.user), context.params.runId, context.user!),
  );
};

export const exportPoolDistributionRowsController: ApiHandler = async (context) => {
  const query = parseSearchParams(context, exportPoolDistributionRowsQuerySchema);
  return ok(await service.generatePayrollExportRows(requireCustomerScope(context.user), query));
};
