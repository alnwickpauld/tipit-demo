import { requireCustomerScope } from "../../../shared/auth/authorization";
import { ok } from "../../../shared/http/response";
import type { ApiHandler } from "../../../shared/http/types";
import { parseJsonBody } from "../../../shared/validation/request";
import {
  updateDepartmentTippingSettingSchema,
  updateServiceAreaTippingSettingSchema,
} from "./tipping-settings.schemas";
import { TippingSettingsService } from "./tipping-settings.service";

const service = new TippingSettingsService();

export const getTippingSettingsController: ApiHandler = async (context) => {
  return ok(await service.get(requireCustomerScope(context.user)));
};

export const updateDepartmentTippingSettingController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, updateDepartmentTippingSettingSchema);

  return ok(
    await service.updateDepartmentSetting(
      requireCustomerScope(context.user),
      context.params.departmentType as
        | "MEETING_EVENTS"
        | "BREAKFAST"
        | "ROOM_SERVICE"
        | "BAR"
        | "RESTAURANT"
        | "OTHER",
      payload,
    ),
  );
};

export const updateServiceAreaTippingSettingController: ApiHandler = async (context) => {
  const payload = await parseJsonBody(context, updateServiceAreaTippingSettingSchema);

  return ok(
    await service.updateServiceAreaSetting(
      requireCustomerScope(context.user),
      context.params.serviceAreaId,
      payload,
    ),
  );
};
