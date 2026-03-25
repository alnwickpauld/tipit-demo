import type { Route } from "next";
import Link from "next/link";

type DashboardShellProps = {
  title: string;
  eyebrow: string;
  description: string;
  children: React.ReactNode;
};

const navItems: Array<{ href: Route; label: string }> = [
  { href: "/dashboard", label: "Overview" },
  { href: "/reports/payroll", label: "Payroll" },
  { href: "/reports/leaderboard", label: "Leaderboard" },
];

export function DashboardShell({
  title,
  eyebrow,
  description,
  children,
}: DashboardShellProps) {
  return (
    <main className="min-h-screen bg-[#f5f7fb] text-[#172033]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="rounded-[2rem] border border-[#d8deea] bg-[linear-gradient(135deg,#0f172a,#233252)] px-5 py-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:px-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[#c8d6ff]">
                {eyebrow}
              </p>
              <h1 className="mt-3 text-balance text-4xl leading-tight">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#d7def1] sm:text-base">
                {description}
              </p>
            </div>
            <nav
              aria-label="Dashboard sections"
              className="flex flex-wrap gap-2 rounded-full bg-white/10 p-1"
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-4 py-2 text-sm font-medium text-white/92 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <div className="mt-6 flex-1">{children}</div>
      </div>
    </main>
  );
}
