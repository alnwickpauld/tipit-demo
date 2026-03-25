export type ApiReferenceRoute = {
  method: "GET" | "POST" | "PATCH";
  path: string;
  tag: string;
  summary: string;
  auth:
    | "Public"
    | "TIPIT_ADMIN"
    | "TIPIT_ADMIN | CUSTOMER_*"
    | "CUSTOMER_READ"
    | "CUSTOMER_OPERATIONS"
    | "CUSTOMER_BILLING";
  body?: string[];
  response: string;
};

export const apiReferenceRoutes: ApiReferenceRoute[] = [
  {
    method: "POST",
    path: "/api/v1/auth/login",
    tag: "Auth",
    summary: "Authenticate a user and issue a signed session token.",
    auth: "Public",
    body: ["email", "password"],
    response: "Authenticated user profile and bearer token.",
  },
  {
    method: "GET",
    path: "/api/v1/auth/me",
    tag: "Auth",
    summary: "Return the current authenticated user from the session token.",
    auth: "TIPIT_ADMIN | CUSTOMER_*",
    response: "Current authenticated user context.",
  },
  {
    method: "GET",
    path: "/api/v1/tipit-admin/customers",
    tag: "Tipit Admin Customers",
    summary: "List hospitality groups with platform fee and payroll settings.",
    auth: "TIPIT_ADMIN",
    response: "Customer summaries with venue and user counts.",
  },
  {
    method: "POST",
    path: "/api/v1/tipit-admin/customers",
    tag: "Tipit Admin Customers",
    summary: "Create a hospitality group and its payroll configuration.",
    auth: "TIPIT_ADMIN",
    body: [
      "name",
      "slug",
      "billingEmail",
      "status",
      "tipitFeePercent",
      "payrollFrequency",
      "payrollAnchorDate",
      "settlementFrequency",
    ],
    response: "Created customer record with payroll settings.",
  },
  {
    method: "GET",
    path: "/api/v1/tipit-admin/customers/:customerId",
    tag: "Tipit Admin Customers",
    summary: "Get a hospitality group by id.",
    auth: "TIPIT_ADMIN",
    response: "Full customer admin view.",
  },
  {
    method: "PATCH",
    path: "/api/v1/tipit-admin/customers/:customerId",
    tag: "Tipit Admin Customers",
    summary: "Update customer profile, platform fee, and payroll settings.",
    auth: "TIPIT_ADMIN",
    body: [
      "name",
      "legalName",
      "billingEmail",
      "tipitFeePercent",
      "payrollFrequency",
      "payrollAnchorDate",
      "settlementFrequency",
    ],
    response: "Updated customer record.",
  },
  {
    method: "PATCH",
    path: "/api/v1/tipit-admin/customers/:customerId/status",
    tag: "Tipit Admin Customers",
    summary: "Suspend or deactivate a hospitality group.",
    auth: "TIPIT_ADMIN",
    body: ["status"],
    response: "Updated customer status.",
  },
  {
    method: "GET",
    path: "/api/v1/tipit-admin/customers/:customerId/users",
    tag: "Tipit Admin Customer Users",
    summary: "List admin users for a hospitality group.",
    auth: "TIPIT_ADMIN",
    response: "Customer user memberships with linked users and roles.",
  },
  {
    method: "POST",
    path: "/api/v1/tipit-admin/customers/:customerId/users",
    tag: "Tipit Admin Customer Users",
    summary: "Create a customer admin, manager, or viewer linked to one customer.",
    auth: "TIPIT_ADMIN",
    body: ["email", "firstName", "lastName", "password", "role"],
    response: "Created customer user membership and linked user.",
  },
  {
    method: "PATCH",
    path: "/api/v1/tipit-admin/customers/:customerId/users/:customerUserId/status",
    tag: "Tipit Admin Customer Users",
    summary: "Activate or deactivate a customer user.",
    auth: "TIPIT_ADMIN",
    body: ["isActive"],
    response: "Updated customer user membership and linked user activity state.",
  },
  {
    method: "GET",
    path: "/api/v1/customer-admin/venues",
    tag: "Customer Admin Venues",
    summary: "List venues for the authenticated customer.",
    auth: "CUSTOMER_READ",
    response: "Customer-scoped venue list.",
  },
  {
    method: "POST",
    path: "/api/v1/customer-admin/venues",
    tag: "Customer Admin Venues",
    summary: "Create a venue for the authenticated customer.",
    auth: "CUSTOMER_OPERATIONS",
    body: ["name", "slug", "description", "addressLine1", "city", "postcode", "country"],
    response: "Created venue.",
  },
  {
    method: "PATCH",
    path: "/api/v1/customer-admin/venues/:venueId",
    tag: "Customer Admin Venues",
    summary: "Update a customer-owned venue.",
    auth: "CUSTOMER_OPERATIONS",
    body: ["name", "description", "status"],
    response: "Updated venue.",
  },
  {
    method: "GET",
    path: "/api/v1/customer-admin/staff",
    tag: "Customer Admin Staff",
    summary: "List staff members for the authenticated customer.",
    auth: "CUSTOMER_READ",
    response: "Customer-scoped staff list.",
  },
  {
    method: "POST",
    path: "/api/v1/customer-admin/staff",
    tag: "Customer Admin Staff",
    summary: "Create a staff member inside a customer-owned venue.",
    auth: "CUSTOMER_OPERATIONS",
    body: ["venueId", "firstName", "lastName", "displayName", "email", "payrollReference"],
    response: "Created staff member.",
  },
  {
    method: "PATCH",
    path: "/api/v1/customer-admin/staff/:staffMemberId",
    tag: "Customer Admin Staff",
    summary: "Update a customer-owned staff member.",
    auth: "CUSTOMER_OPERATIONS",
    body: ["displayName", "email", "status", "venueId"],
    response: "Updated staff member.",
  },
  {
    method: "GET",
    path: "/api/v1/customer-admin/pools",
    tag: "Customer Admin Pools",
    summary: "List pools for the authenticated customer.",
    auth: "CUSTOMER_READ",
    response: "Customer-scoped pools with members.",
  },
  {
    method: "POST",
    path: "/api/v1/customer-admin/pools",
    tag: "Customer Admin Pools",
    summary: "Create a staff pool for the authenticated customer.",
    auth: "CUSTOMER_OPERATIONS",
    body: ["venueId", "name", "slug", "description", "memberStaffIds"],
    response: "Created pool.",
  },
  {
    method: "PATCH",
    path: "/api/v1/customer-admin/pools/:poolId",
    tag: "Customer Admin Pools",
    summary: "Update a customer-owned pool and its members.",
    auth: "CUSTOMER_OPERATIONS",
    body: ["name", "status", "memberStaffIds"],
    response: "Updated pool.",
  },
  {
    method: "GET",
    path: "/api/v1/customer-admin/allocation-rules",
    tag: "Customer Admin Allocation Rules",
    summary: "List allocation rules for the authenticated customer.",
    auth: "CUSTOMER_READ",
    response: "Customer-scoped allocation rules with lines.",
  },
  {
    method: "POST",
    path: "/api/v1/customer-admin/allocation-rules",
    tag: "Customer Admin Allocation Rules",
    summary: "Create an allocation rule for a customer-owned venue.",
    auth: "CUSTOMER_OPERATIONS",
    body: ["venueId", "name", "priority", "isActive", "effectiveFrom", "effectiveTo", "lines"],
    response: "Created allocation rule.",
  },
  {
    method: "PATCH",
    path: "/api/v1/customer-admin/allocation-rules/:ruleId",
    tag: "Customer Admin Allocation Rules",
    summary: "Update an allocation rule for the authenticated customer.",
    auth: "CUSTOMER_OPERATIONS",
    body: ["name", "priority", "isActive", "effectiveFrom", "effectiveTo", "lines"],
    response: "Updated allocation rule.",
  },
  {
    method: "GET",
    path: "/api/v1/customer-admin/payroll-settings",
    tag: "Customer Admin Payroll",
    summary: "Get payroll settings for the authenticated customer.",
    auth: "CUSTOMER_READ",
    response: "Customer payroll configuration.",
  },
  {
    method: "PATCH",
    path: "/api/v1/customer-admin/payroll-settings",
    tag: "Customer Admin Payroll",
    summary: "Update payroll and settlement settings for the authenticated customer.",
    auth: "CUSTOMER_BILLING",
    body: ["frequency", "payPeriodAnchor", "settlementDay", "exportEmail", "notes", "currency"],
    response: "Updated payroll configuration.",
  },
];

export const apiReferenceTags = [
  "Auth",
  "Tipit Admin Customers",
  "Tipit Admin Customer Users",
  "Customer Admin Venues",
  "Customer Admin Staff",
  "Customer Admin Pools",
  "Customer Admin Allocation Rules",
  "Customer Admin Payroll",
] as const;

export function buildOpenApiDocument() {
  const paths = Object.fromEntries(
    apiReferenceRoutes.map((route) => [
      route.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}"),
      {
        [route.method.toLowerCase()]: {
          tags: [route.tag],
          summary: route.summary,
          security: route.auth === "Public" ? [] : [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: route.response,
            },
          },
        },
      },
    ]),
  );

  return {
    openapi: "3.1.0",
    info: {
      title: "Tipit Backend API",
      version: "0.1.0",
      description:
        "Reference for the Tipit admin backend APIs, including authentication, Tipit Admin, and Customer Admin routes.",
    },
    servers: [
      {
        url: "/",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT-like signed session token",
        },
      },
    },
    tags: apiReferenceTags.map((name) => ({ name })),
    paths,
  };
}
