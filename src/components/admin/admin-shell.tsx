import type { Route } from "next";

import type { AuthenticatedUser } from "../../server/shared/auth/types";
import { AdminNav } from "./admin-nav";
import { LogoutButton } from "./logout-button";

type NavItem = {
  href: Route;
  label: string;
};

type AdminShellProps = {
  title: string;
  eyebrow: string;
  description: string;
  navItems: NavItem[];
  user: AuthenticatedUser;
  children: React.ReactNode;
};

function formatRole(role: AuthenticatedUser["role"]) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AdminShell({
  title,
  eyebrow,
  description,
  navItems,
  user,
  children,
}: AdminShellProps) {
  return (
    <main className="min-h-screen bg-[#edf1f7] text-[#152033]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="rounded-[2rem] border border-[#d4ddeb] bg-[linear-gradient(135deg,#0f172a,#1e2c49)] px-5 py-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:px-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.32em] text-[#cbd8ff]">
                {eyebrow}
              </p>
              <h1 className="mt-3 text-balance text-4xl leading-tight">{title}</h1>
              <p className="mt-3 text-sm leading-7 text-[#dbe3f7] sm:text-base">
                {description}
              </p>
            </div>
            <div className="flex flex-col items-start gap-4 xl:items-end">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/8 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.28em] text-[#b9caef]">
                  Signed in as
                </p>
                <p className="mt-2 text-base font-semibold">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-sm text-[#dbe3f7]">
                  {user.email} · {formatRole(user.role)}
                </p>
              </div>
              <LogoutButton />
            </div>
          </div>
          <AdminNav navItems={navItems} />
        </header>

        <div className="mt-6 flex-1">{children}</div>
      </div>
    </main>
  );
}
