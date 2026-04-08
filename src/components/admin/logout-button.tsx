"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);

    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.push("/login");
      router.refresh();
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="inline-flex items-center rounded-xl border border-[rgba(255,255,255,0.22)] bg-[rgba(255,255,255,0.10)] px-4 py-3 text-sm font-semibold text-[#fff8f1] transition hover:bg-[rgba(255,255,255,0.16)] focus:outline-none focus:ring-2 focus:ring-[#e6d7c7]/60 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isLoading ? "Signing out..." : "Sign out"}
    </button>
  );
}
