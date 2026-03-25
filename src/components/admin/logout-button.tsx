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
      className="inline-flex items-center rounded-xl border border-[#242424] bg-[#0d0d0d] px-4 py-3 text-sm font-semibold text-white transition hover:border-[#3a3a3a] hover:bg-[#121212] focus:outline-none focus:ring-2 focus:ring-[#f5d31d]/60 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isLoading ? "Signing out..." : "Sign out"}
    </button>
  );
}
