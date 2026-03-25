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
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#f5d31d]/60 ${
              isActive
                ? "bg-[#f5d31d] shadow-[0_8px_22px_rgba(245,211,29,0.24)]"
                : "border border-transparent hover:border-[#1a1a1a] hover:bg-[#0f0f0f]"
            }`}
            style={{
              color: isActive ? "#111111" : "rgba(255, 255, 255, 0.92)",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
