import type { Route } from "next";

import { AdminShellDesigner } from "../../components/admin/admin-shell-designer";
import { SandmanLogo } from "../../components/brand/sandman-logo";
import { requireCustomerUser } from "../../lib/admin-session";

export const dynamic = "force-dynamic";

const navItems: Array<{ href: Route; label: string }> = [
  { href: "/customer-admin", label: "Overview" },
  { href: "/customer-admin/venues", label: "Venues" },
  { href: "/customer-admin/departments", label: "Departments" },
  { href: "/customer-admin/service-areas", label: "Service Areas" },
  { href: "/customer-admin/staff", label: "Staff" },
  { href: "/customer-admin/pools", label: "Pools" },
  { href: "/customer-admin/tip-out-rules", label: "Tip-Out Rules" },
  { href: "/customer-admin/payroll/pool-distribution" as Route, label: "Pool Distribution" },
  { href: "/customer-admin/reports/payroll", label: "Payroll Report" },
  { href: "/customer-admin/reports/leaderboard", label: "Leaderboard" },
  { href: "/customer-admin/payroll", label: "Settings" },
];

export default async function CustomerAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireCustomerUser();

  return (
    <AdminShellDesigner
      title="Customer Admin"
      eyebrow="Customer workspace"
      description="Manage your venues, departments, service areas, staff, pools, and payroll settings inside your customer boundary."
      navItems={navItems}
      user={user}
      brand={<SandmanLogo className="pl-1" alt="Sandman Signature Hotel Group UK" />}
    >
      {children}
    </AdminShellDesigner>
  );
}
