"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type CustomerSummary = {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  billingEmail: string;
  contactPhone: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  tipitFeePercent: number;
  payrollFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | null;
  payrollAnchorDate: Date | string | null;
  settlementFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  currency: string;
  timezone: string;
  venueCount: number;
  customerUserCount: number;
};

type CustomerFormState = {
  name: string;
  slug: string;
  legalName: string;
  billingEmail: string;
  contactPhone: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  tipitFeePercent: string;
  payrollFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  payrollAnchorDate: string;
  settlementFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  currency: string;
  timezone: string;
};

type ApiErrorResponse = {
  message?: string;
};

function toDateInput(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function toFormState(customer: CustomerSummary): CustomerFormState {
  return {
    name: customer.name,
    slug: customer.slug,
    legalName: customer.legalName ?? "",
    billingEmail: customer.billingEmail,
    contactPhone: customer.contactPhone ?? "",
    status: customer.status,
    tipitFeePercent: customer.tipitFeePercent.toFixed(2).replace(/\.00$/, ""),
    payrollFrequency: customer.payrollFrequency ?? "WEEKLY",
    payrollAnchorDate: toDateInput(customer.payrollAnchorDate),
    settlementFrequency: customer.settlementFrequency,
    currency: customer.currency,
    timezone: customer.timezone,
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
  return <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c7a6c]">{children}</span>;
}

export function CustomersManager({ customers }: { customers: CustomerSummary[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(customers[0]?.id ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, CustomerFormState>>(
    Object.fromEntries(customers.map((customer) => [customer.id, toFormState(customer)])),
  );

  const editingCustomer = useMemo(
    () => customers.find((customer) => customer.id === editingId) ?? customers[0] ?? null,
    [customers, editingId],
  );

  function updateField(customerId: string, field: keyof CustomerFormState, value: string) {
    setForms((current) => ({
      ...current,
      [customerId]: {
        ...(current[customerId] ?? toFormState(editingCustomer!)),
        [field]: value,
      },
    }));
  }

  function handleSave(customerId: string) {
    const form = forms[customerId];
    if (!form) {
      return;
    }

    startTransition(async () => {
      try {
        await sendJson(`/api/v1/tipit-admin/customers/${customerId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name.trim(),
            slug: form.slug.trim(),
            legalName: form.legalName.trim() || undefined,
            billingEmail: form.billingEmail.trim(),
            contactPhone: form.contactPhone.trim() || undefined,
            status: form.status,
            tipitFeePercent: Number(form.tipitFeePercent),
            payrollFrequency: form.payrollFrequency,
            payrollAnchorDate: form.payrollAnchorDate || undefined,
            settlementFrequency: form.settlementFrequency,
            currency: form.currency.trim().toUpperCase(),
            timezone: form.timezone.trim(),
          }),
        });

        setMessage("Customer updated.");
        setError(null);
        router.refresh();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to update customer");
      }
    });
  }

  if (!editingCustomer) {
    return (
      <section className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
        <p className="text-sm text-[#887568]">No customers available.</p>
      </section>
    );
  }

  const currentForm = forms[editingCustomer.id] ?? toFormState(editingCustomer);

  return (
    <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
      <article className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
        <p className="text-xs uppercase tracking-[0.26em] text-[#8c7a6c]">Customers</p>
        <h2 className="mt-2 text-2xl text-[#45372f]">Hospitality groups</h2>
        <div className="mt-6 grid gap-4">
          {customers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => setEditingId(customer.id)}
              className={`rounded-[1.4rem] border p-4 text-left transition ${
                customer.id === editingCustomer.id
                  ? "border-[#b59f8a] bg-[#f8f1ea] shadow-[0_10px_28px_rgba(123,95,72,0.10)]"
                  : "border-[#e0d0c0] bg-[rgba(255,253,250,0.72)]"
              }`}
            >
              <p className="text-lg font-semibold text-[#45372f]">{customer.name}</p>
              <p className="mt-2 text-sm text-[#7b685b]">{customer.billingEmail}</p>
              <p className="mt-3 text-sm text-[#5f5045]">
                {customer.venueCount} venues / {customer.customerUserCount} users
              </p>
            </button>
          ))}
        </div>
      </article>

      <article className="customer-admin-manager rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
        <p className="text-xs uppercase tracking-[0.26em] text-[#8c7a6c]">Customer details</p>
        <h2 className="mt-2 text-2xl text-[#45372f]">Edit customer</h2>
        <p className="mt-2 text-sm text-[#7f6c5f]">
          Update commercial settings, billing details, and payroll defaults for {editingCustomer.name}.
        </p>

        {message ? (
          <p className="mt-4 rounded-2xl border border-[#cdd8c2] bg-[#f4f8ef] px-4 py-3 text-sm text-[#5f7c44]">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-2xl border border-[#dfc0b6] bg-[#fff2ee] px-4 py-3 text-sm text-[#9d5848]">
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <FieldLabel>Name</FieldLabel>
            <input value={currentForm.name} onChange={(event) => updateField(editingCustomer.id, "name", event.target.value)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none" />
          </label>
          <label className="block">
            <FieldLabel>Slug</FieldLabel>
            <input value={currentForm.slug} onChange={(event) => updateField(editingCustomer.id, "slug", event.target.value)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none" />
          </label>
          <label className="block">
            <FieldLabel>Legal name</FieldLabel>
            <input value={currentForm.legalName} onChange={(event) => updateField(editingCustomer.id, "legalName", event.target.value)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none" />
          </label>
          <label className="block">
            <FieldLabel>Billing email</FieldLabel>
            <input type="email" value={currentForm.billingEmail} onChange={(event) => updateField(editingCustomer.id, "billingEmail", event.target.value)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none" />
          </label>
          <label className="block">
            <FieldLabel>Phone</FieldLabel>
            <input value={currentForm.contactPhone} onChange={(event) => updateField(editingCustomer.id, "contactPhone", event.target.value)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none" />
          </label>
          <label className="block">
            <FieldLabel>Status</FieldLabel>
            <select value={currentForm.status} onChange={(event) => updateField(editingCustomer.id, "status", event.target.value)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </label>
          <label className="block">
            <FieldLabel>Tipit fee %</FieldLabel>
            <input type="number" min="0" max="100" step="0.01" value={currentForm.tipitFeePercent} onChange={(event) => updateField(editingCustomer.id, "tipitFeePercent", event.target.value)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none" />
          </label>
          <label className="block">
            <FieldLabel>Payroll frequency</FieldLabel>
            <select value={currentForm.payrollFrequency} onChange={(event) => updateField(editingCustomer.id, "payrollFrequency", event.target.value)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none">
              <option value="WEEKLY">Weekly</option>
              <option value="FORTNIGHTLY">Fortnightly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </label>
          <label className="block">
            <FieldLabel>Settlement frequency</FieldLabel>
            <select value={currentForm.settlementFrequency} onChange={(event) => updateField(editingCustomer.id, "settlementFrequency", event.target.value)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none">
              <option value="WEEKLY">Weekly</option>
              <option value="FORTNIGHTLY">Fortnightly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </label>
          <label className="block">
            <FieldLabel>Payroll anchor date</FieldLabel>
            <input type="date" value={currentForm.payrollAnchorDate} onChange={(event) => updateField(editingCustomer.id, "payrollAnchorDate", event.target.value)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none" />
          </label>
          <label className="block">
            <FieldLabel>Timezone</FieldLabel>
            <input value={currentForm.timezone} onChange={(event) => updateField(editingCustomer.id, "timezone", event.target.value)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none" />
          </label>
          <label className="block">
            <FieldLabel>Currency</FieldLabel>
            <input value={currentForm.currency} maxLength={3} onChange={(event) => updateField(editingCustomer.id, "currency", event.target.value.toUpperCase())} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none" />
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => handleSave(editingCustomer.id)}
            disabled={isPending}
            className="rounded-full border border-[#b49e89] bg-[#b49e89] px-5 py-3 text-sm font-semibold text-[#fffaf4] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save customer"}
          </button>
        </div>
      </article>
    </section>
  );
}
