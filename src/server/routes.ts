import { authRoutes } from "./domains/auth/auth.routes";
import { allocationRulesRoutes } from "./domains/customer-admin/allocation-rules/allocation-rules.routes";
import { departmentsRoutes } from "./domains/customer-admin/departments/departments.routes";
import { payrollSettingsRoutes } from "./domains/customer-admin/payroll-settings/payroll-settings.routes";
import { poolsRoutes } from "./domains/customer-admin/pools/pools.routes";
import { qrAssetsRoutes } from "./domains/customer-admin/qr-assets/qr-assets.routes";
import { serviceAreasRoutes } from "./domains/customer-admin/service-areas/service-areas.routes";
import { shiftsRoutes } from "./domains/customer-admin/shifts/shifts.routes";
import { staffRoutes } from "./domains/customer-admin/staff/staff.routes";
import { tippingSettingsRoutes } from "./domains/customer-admin/tipping-settings/tipping-settings.routes";
import { venuesRoutes } from "./domains/customer-admin/venues/venues.routes";
import { customerStatusRoutes } from "./domains/tipit-admin/customer-status/customer-status.routes";
import { customerUsersRoutes } from "./domains/tipit-admin/customer-users/customer-users.routes";
import { customersRoutes } from "./domains/tipit-admin/customers/customers.routes";
import { feeSettingsRoutes } from "./domains/tipit-admin/fee-settings/fee-settings.routes";
import type { RouteDefinition } from "./shared/http/types";

export const backendRoutes: RouteDefinition[] = [
  ...authRoutes,
  ...customersRoutes,
  ...customerUsersRoutes,
  ...feeSettingsRoutes,
  ...customerStatusRoutes,
  ...venuesRoutes,
  ...departmentsRoutes,
  ...qrAssetsRoutes,
  ...serviceAreasRoutes,
  ...shiftsRoutes,
  ...staffRoutes,
  ...tippingSettingsRoutes,
  ...poolsRoutes,
  ...allocationRulesRoutes,
  ...payrollSettingsRoutes,
];
