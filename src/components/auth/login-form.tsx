"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type LoginState = {
  email: string;
  password: string;
};

type LoginResponse = {
  data?: {
    user: {
      role: "TIPIT_ADMIN" | "CUSTOMER_ADMIN" | "CUSTOMER_MANAGER" | "CUSTOMER_VIEWER";
    };
  };
  error?: {
    message?: string;
  };
};

const demoCredentials = [
  {
    label: "Tipit Admin",
    email: "platform-admin@tipit.example",
    password: "Password123!",
  },
  {
    label: "Sandman Admin",
    email: "admin@sandman.example",
    password: "Password123!",
  },
  {
    label: "Sandman Manager",
    email: "manager@sandman.example",
    password: "Password123!",
  },
  {
    label: "Sandman Viewer",
    email: "viewer@sandman.example",
    password: "Password123!",
  },
];

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<LoginState>({
    email: demoCredentials[0].email,
    password: demoCredentials[0].password,
  });
  const [error, setError] = useState<string | null>(null);

  function fillDemo(login: LoginState) {
    setForm(login);
    setError(null);
  }

  function updateField(field: keyof LoginState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as LoginResponse;
      if (!response.ok || !payload.data) {
        setError(payload.error?.message ?? "We couldn't sign you in.");
        return;
      }

      const destination =
        payload.data.user.role === "TIPIT_ADMIN" ? "/admin" : "/customer-admin";

      router.push(destination);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[2rem] border border-[#d5ddec] bg-white p-8 shadow-[0_28px_70px_rgba(15,23,42,0.08)]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#6a7791]">
          Tipit admin access
        </p>
        <h1 className="mt-4 text-4xl leading-tight text-[#101828]">
          Sign in to manage hospitality groups, venues, staff, and payroll settings.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#5c667c]">
          The backend APIs are already wired. This screen gives you a real browser entry
          point into the seeded Tipit Admin and Customer Admin areas.
        </p>

        <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[#243147]">Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              className="h-12 rounded-2xl border border-[#d8deea] bg-[#f8fafe] px-4 text-base text-[#101828] outline-none transition focus:border-[#243147] focus:ring-2 focus:ring-[#243147]/10"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[#243147]">Password</span>
            <input
              type="password"
              required
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              className="h-12 rounded-2xl border border-[#d8deea] bg-[#f8fafe] px-4 text-base text-[#101828] outline-none transition focus:border-[#243147] focus:ring-2 focus:ring-[#243147]/10"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-[#f2c7c7] bg-[#fff4f4] px-4 py-3 text-sm text-[#a12626]">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 inline-flex h-12 items-center justify-center rounded-full bg-[#1d2841] px-6 text-sm font-semibold text-white transition hover:bg-[#101828] focus:outline-none focus:ring-2 focus:ring-[#1d2841]/40 disabled:cursor-not-allowed disabled:opacity-75"
          >
            {isPending ? "Signing in..." : "Open admin area"}
          </button>
        </form>
      </section>

      <aside className="rounded-[2rem] border border-[#d5ddec] bg-[linear-gradient(180deg,#ffffff,#f4f7fc)] p-8 shadow-[0_28px_70px_rgba(15,23,42,0.08)]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#6a7791]">
          Demo accounts
        </p>
        <div className="mt-6 grid gap-3">
          {demoCredentials.map((credential) => (
            <button
              key={credential.email}
              type="button"
              onClick={() => fillDemo(credential)}
              className="rounded-[1.5rem] border border-[#d8deea] bg-white px-4 py-4 text-left transition hover:border-[#243147] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-2 focus:ring-[#243147]/15"
            >
              <p className="text-sm font-semibold text-[#101828]">{credential.label}</p>
              <p className="mt-1 text-sm text-[#516075]">{credential.email}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.22em] text-[#7a859c]">
                Password123!
              </p>
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-[#d8deea] bg-[#eef3fb] px-4 py-4 text-sm leading-6 text-[#46546a]">
          Tipit Admin opens the platform-level customer area. Customer users open the
          customer-scoped workspace with venues, staff, pools, and payroll settings.
        </div>
      </aside>
    </div>
  );
}
