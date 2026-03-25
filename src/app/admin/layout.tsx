import type { Route } from "next";

import { AdminShellDesigner } from "../../components/admin/admin-shell-designer";
import { requireTipitAdmin } from "../../lib/admin-session";

const navItems: Array<{ href: Route; label: string }> = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/api-reference", label: "API Reference" },
];

export default async function TipitAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireTipitAdmin();

  return (
    <AdminShellDesigner
      title="Tipit Admin"
      eyebrow="Platform operations"
      description="Manage hospitality groups, customer users, commercial settings, and platform access from one place."
      navItems={navItems}
      user={user}
      brand={
        <div className="flex h-[36px] items-center">
          <span className="text-[2rem] font-medium tracking-[-0.03em] text-white">Tipit</span>
        </div>
      }
    >
      {children}
    </AdminShellDesigner>
  );
}
