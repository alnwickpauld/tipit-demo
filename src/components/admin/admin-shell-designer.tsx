import type { Route } from "next";
import type { ReactNode } from "react";

import type { AuthenticatedUser } from "../../server/shared/auth/types";
import { AdminNav } from "./admin-nav";
import { SandmanWordmark } from "../brand/sandman-wordmark";
import { LogoutButton } from "./logout-button";

type NavItem = {
  href: Route;
  label: string;
};

type AdminShellDesignerProps = {
  title: string;
  eyebrow: string;
  description: string;
  navItems: NavItem[];
  user: AuthenticatedUser;
  brand?: ReactNode;
  children: ReactNode;
};

function formatRole(role: AuthenticatedUser["role"]) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AdminShellDesigner({
  title,
  eyebrow,
  description,
  navItems,
  user,
  brand,
  children,
}: AdminShellDesignerProps) {
  return (
    <main className="sandman-admin-shell min-h-screen bg-[#ece1d1] text-[#2f241d]">
      <div className="min-h-screen lg:grid lg:grid-cols-[228px_1fr]">
        <aside className="relative overflow-hidden border-r border-[#d9c7b2] bg-[#8f7d6c] px-4 py-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)]" />
          <div className="flex h-full flex-col">
            <div className="px-2">
              {brand ?? (
                <SandmanWordmark className="items-start text-left" subtitle="Customer Admin" />
              )}
            </div>

            <AdminNav navItems={navItems} />

            <div className="mt-auto border-t border-[rgba(255,255,255,0.16)] pt-6">
              <div className="px-2">
                <p className="text-xs uppercase tracking-[0.22em] text-[rgba(248,242,235,0.66)]">
                  {eyebrow}
                </p>
                <p className="mt-3 text-sm leading-6 text-[#f3ece4]">{description}</p>
                <p className="mt-4 text-sm font-semibold text-[#fdf8f2]">
                  {formatRole(user.role)}
                </p>
              </div>
              <div className="mt-4 px-2">
                <LogoutButton />
              </div>
            </div>
          </div>
        </aside>

        <section className="relative min-w-0 overflow-hidden bg-[linear-gradient(180deg,#efe5d8_0%,#eadfce_100%)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(171,143,113,0.18),transparent_32%)]" />
          <header className="relative border-b border-[#d7c7b4] px-6 py-6 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-balance text-4xl font-medium leading-tight text-[#463830] sm:text-5xl">
                  Welcome back, <span className="text-[#9a846f]">{user.firstName}</span>
                </h1>
                <p className="mt-3 text-sm text-[#7d695a] sm:text-base">{title}</p>
              </div>

              <div className="flex items-center gap-3 rounded-full border border-[#d8c7b2] bg-[rgba(255,250,245,0.76)] px-4 py-3 shadow-[0_10px_26px_rgba(94,64,41,0.08)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#b5a08c,#7f6c5d)] text-sm font-bold text-[#fffaf4]">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#4c3d34]">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-[#8d7868]">Account settings</p>
                </div>
              </div>
            </div>
          </header>

          <div className="relative px-6 py-8 sm:px-8 lg:px-10">{children}</div>
        </section>
      </div>
    </main>
  );
}
