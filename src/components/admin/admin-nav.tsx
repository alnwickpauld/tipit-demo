"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: Route;
  label: string;
};

export function AdminNav({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="mt-10 flex flex-col gap-3"
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#b69b81]/60 ${
              isActive
                ? "bg-[#f7f0e8] shadow-[0_10px_24px_rgba(54,34,18,0.14)]"
                : "border border-transparent hover:border-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.08)]"
            }`}
            style={{
              color: isActive ? "#5b4a3f" : "rgba(255, 247, 239, 0.96)",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
