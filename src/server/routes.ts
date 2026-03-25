import { authRoutes } from "./domains/auth/auth.routes";
import { allocationRulesRoutes } from "./domains/customer-admin/allocation-rules/allocation-rules.routes";
import { payrollSettingsRoutes } from "./domains/customer-admin/payroll-settings/payroll-settings.routes";
import { poolsRoutes } from "./domains/customer-admin/pools/pools.routes";
import { staffRoutes } from "./domains/customer-admin/staff/staff.routes";
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
  ...staffRoutes,
  ...poolsRoutes,
  ...allocationRulesRoutes,
  ...payrollSettingsRoutes,
];
