export type AdminScope = "TIPIT_ADMIN" | "CUSTOMER_ADMIN";

export type ApiRole =
  | "CUSTOMER_ADMIN"
  | "CUSTOMER_MANAGER"
  | "CUSTOMER_VIEWER"
  | "TIPIT_ADMIN";

export type AuthenticatedUser = {
  userId: string;
  customerUserId: string | null;
  customerId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: ApiRole;
  scope: AdminScope;
};
