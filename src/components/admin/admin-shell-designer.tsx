import type { Route } from "next";
import Image from "next/image";
import type { ReactNode } from "react";

import type { AuthenticatedUser } from "../../server/shared/auth/types";
import { AdminNav } from "./admin-nav";
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
    <main className="min-h-screen bg-[#040404] text-white">
      <div className="min-h-screen lg:grid lg:grid-cols-[228px_1fr]">
        <aside className="relative overflow-hidden border-r border-[#5f4d10] bg-[#050505] px-4 py-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(245,211,29,0.45),transparent)]" />
          <div className="flex h-full flex-col">
            <div className="px-2">
              {brand ?? (
                <Image
                  src="/logo.png"
                  alt="Shark Club"
                  width={220}
                  height={36}
                  priority
                  className="h-auto w-[155px] max-w-full"
                />
              )}
            </div>

            <AdminNav navItems={navItems} />

            <div className="mt-auto border-t border-[#171717] pt-6">
              <div className="px-2">
                <p className="text-xs uppercase tracking-[0.22em] text-[#7f7f7f]">
                  {eyebrow}
                </p>
                <p className="mt-3 text-sm leading-6 text-[#afafaf]">{description}</p>
                <p className="mt-4 text-sm font-semibold text-[#f5d31d]">
                  {formatRole(user.role)}
                </p>
              </div>
              <div className="mt-4 px-2">
                <LogoutButton />
              </div>
            </div>
          </div>
        </aside>

        <section className="relative min-w-0 overflow-hidden bg-[#050505]">
          <div className="pointer-events-none absolute left-0 top-0 h-16 w-80 bg-[linear-gradient(115deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_55%,transparent_56%)]" />
          <header className="relative border-b border-[#5f4d10] px-6 py-6 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-balance text-4xl font-medium leading-tight text-white sm:text-5xl">
                  Welcome back, <span className="text-[#f5d31d]">{user.firstName}</span>
                </h1>
                <p className="mt-3 text-sm text-[#b6b6b6] sm:text-base">{title}</p>
              </div>

              <div className="flex items-center gap-3 rounded-full border border-[#1b1b1b] bg-[#0d0d0d] px-4 py-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#62ddea,#f5d31d)] text-sm font-bold text-[#050505]">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#f5d31d]">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-[#b6b6b6]">Account settings</p>
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
