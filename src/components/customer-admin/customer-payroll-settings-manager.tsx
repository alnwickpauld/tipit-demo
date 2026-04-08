"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type PayrollSettingsManagerProps = {
  customer: {
    id: string;
    name: string;
    timezone: string;
    currency: string;
    payrollConfig: {
      frequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
      settlementFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
      payPeriodAnchor: Date | string | null;
      settlementDay: number | null;
      exportEmail: string | null;
      notes: string | null;
    } | null;
  };
  canManage: boolean;
};

type FormState = {
  frequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  settlementFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  payPeriodAnchor: string;
  settlementDay: string;
  exportEmail: string;
  notes: string;
  timezone: string;
  currency: string;
};

type ApiErrorResponse = {
  message?: string;
};

function formatDateInput(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function createInitialForm(customer: PayrollSettingsManagerProps["customer"]): FormState {
  return {
    frequency: customer.payrollConfig?.frequency ?? "WEEKLY",
    settlementFrequency: customer.payrollConfig?.settlementFrequency ?? "WEEKLY",
    payPeriodAnchor: formatDateInput(customer.payrollConfig?.payPeriodAnchor),
    settlementDay: customer.payrollConfig?.settlementDay?.toString() ?? "",
    exportEmail: customer.payrollConfig?.exportEmail ?? "",
    notes: customer.payrollConfig?.notes ?? "",
    timezone: customer.timezone,
    currency: customer.currency,
  };
}

async function sendJson<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiErrorResponse;
    throw new Error(error.message ?? "Request failed");
  }

  return (await response.json()) as T;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">{children}</span>;
}

export function CustomerPayrollSettingsManager({
  customer,
  canManage,
}: PayrollSettingsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(() => createInitialForm(customer));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await sendJson("/api/v1/customer-admin/payroll-settings", {
          method: "PATCH",
          body: JSON.stringify({
            frequency: form.frequency,
            settlementFrequency: form.settlementFrequency,
            payPeriodAnchor: form.payPeriodAnchor || undefined,
            settlementDay: form.settlementDay ? Number(form.settlementDay) : undefined,
            exportEmail: form.exportEmail.trim() || undefined,
            notes: form.notes.trim() || undefined,
            timezone: form.timezone.trim(),
            currency: form.currency.trim().toUpperCase(),
          }),
        });

        setMessage("Settings updated.");
        setError(null);
        router.refresh();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to update settings");
      }
    });
  }

  return (
    <section className="customer-admin-manager grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <article className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
        <p className="text-xs uppercase tracking-[0.26em] text-[#8d8d8d]">Settings</p>
        <h2 className="mt-2 text-2xl text-white">Payroll configuration</h2>
        <p className="mt-2 text-sm text-[#9b9b9b]">
          Control payroll timing, settlement cadence, and export preferences for {customer.name}.
        </p>

        {message ? (
          <p className="mt-4 rounded-2xl border border-[#2d4617] bg-[#0d160a] px-4 py-3 text-sm text-[#9ee16f]">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-2xl border border-[#4f1f1a] bg-[#170b0a] px-4 py-3 text-sm text-[#ff8f81]">
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <FieldLabel>Payroll frequency</FieldLabel>
            <select
              value={form.frequency}
              onChange={(event) => updateField("frequency", event.target.value)}
              disabled={!canManage || isPending}
              className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            >
              <option value="WEEKLY">Weekly</option>
              <option value="FORTNIGHTLY">Fortnightly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </label>

          <label className="block">
            <FieldLabel>Settlement frequency</FieldLabel>
            <select
              value={form.settlementFrequency}
              onChange={(event) => updateField("settlementFrequency", event.target.value)}
              disabled={!canManage || isPending}
              className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            >
              <option value="WEEKLY">Weekly</option>
              <option value="FORTNIGHTLY">Fortnightly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </label>

          <label className="block">
            <FieldLabel>Payroll anchor date</FieldLabel>
            <input
              type="date"
              value={form.payPeriodAnchor}
              onChange={(event) => updateField("payPeriodAnchor", event.target.value)}
              disabled={!canManage || isPending}
              className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            />
          </label>

          <label className="block">
            <FieldLabel>Settlement day</FieldLabel>
            <input
              type="number"
              min="1"
              max="31"
              value={form.settlementDay}
              onChange={(event) => updateField("settlementDay", event.target.value)}
              disabled={!canManage || isPending}
              className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            />
          </label>

          <label className="block">
            <FieldLabel>Timezone</FieldLabel>
            <input
              value={form.timezone}
              onChange={(event) => updateField("timezone", event.target.value)}
              disabled={!canManage || isPending}
              className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            />
          </label>

          <label className="block">
            <FieldLabel>Currency</FieldLabel>
            <input
              value={form.currency}
              maxLength={3}
              onChange={(event) => updateField("currency", event.target.value.toUpperCase())}
              disabled={!canManage || isPending}
              className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            />
          </label>

          <label className="block md:col-span-2">
            <FieldLabel>Export email</FieldLabel>
            <input
              type="email"
              value={form.exportEmail}
              onChange={(event) => updateField("exportEmail", event.target.value)}
              disabled={!canManage || isPending}
              className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            />
          </label>

          <label className="block md:col-span-2">
            <FieldLabel>Notes</FieldLabel>
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              disabled={!canManage || isPending}
              rows={4}
              className="mt-2 w-full rounded-2xl border border-[#4a4a4a] bg-[#0b0b0b] px-4 py-3 text-sm text-white outline-none"
            />
          </label>
        </div>

        {canManage ? (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-full border border-[#b49e89] bg-[#b49e89] px-5 py-3 text-sm font-semibold text-[#fffaf4] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save settings"}
            </button>
          </div>
        ) : null}
      </article>

      <article className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
        <p className="text-xs uppercase tracking-[0.26em] text-[#8d8d8d]">Permissions</p>
        <h2 className="mt-2 text-2xl text-white">What your role can do</h2>
        <div className="mt-6 grid gap-3">
          {[
            "TIPIT_ADMIN can manage platform-wide customer settings.",
            "CUSTOMER_ADMIN can update payroll configuration for their own customer.",
            "CUSTOMER_MANAGER and CUSTOMER_VIEWER can view payroll settings but cannot edit them.",
          ].map((item) => (
            <div
              key={item}
            className="rounded-[1.4rem] border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] px-4 py-4 text-sm leading-6 text-[#5f5045]"
            >
              {item}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
