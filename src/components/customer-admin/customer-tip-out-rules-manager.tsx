"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type VenueOption = {
  id: string;
  name: string;
};

type DepartmentOption = {
  id: string;
  venueId: string;
  name: string;
  revenueCentreType: string;
  isActive: boolean;
};

type PoolOption = {
  id: string;
  venueId: string;
  name: string;
  poolType: string;
  status: "ACTIVE" | "INACTIVE";
};

type StaffOption = {
  id: string;
  venueId: string;
  displayName: string | null;
  firstName: string;
  lastName: string;
  status: "ACTIVE" | "INACTIVE";
};

type PayrollPeriodOption = {
  id: string;
  label: string | null;
  startDate: Date | string;
  endDate: Date | string;
};

type TipOutRuleSummary = {
  id: string;
  scope: "CUSTOMER" | "VENUE" | "DEPARTMENT";
  venueId: string | null;
  departmentId: string | null;
  targetPoolId: string;
  name: string;
  description: string | null;
  rateDecimal: number;
  ratePercentage: number;
  ratePercentageLabel: string;
  capAtAvailableTipBalance: boolean;
  isActive: boolean;
  venue?: { id: string; name: string };
  department?: { id: string; name: string; revenueCentreType: string };
  targetPool?: { id: string; name: string; poolType: string };
};

type TipOutRuleFormState = {
  scope: "CUSTOMER" | "VENUE" | "DEPARTMENT";
  venueId: string;
  departmentId: string;
  targetPoolId: string;
  name: string;
  description: string;
  ratePercentage: string;
  capAtAvailableTipBalance: boolean;
  isActive: boolean;
};

type TipOutPreviewState = {
  tipOutRuleId: string;
  venueId: string;
  departmentId: string;
  staffMemberId: string;
  businessDate: string;
  totalSales: string;
  discounts: string;
  availableTipBalance: string;
};

type TipOutPreviewResult = {
  rule: TipOutRuleSummary;
  staffMemberId: string;
  targetPool: {
    id: string;
    name: string;
    poolType: string;
  };
  businessDate: string;
  totalSales: number;
  discounts: number;
  netSales: number;
  availableTipBalance: number;
  rateDecimal: number;
  ratePercentage: number;
  requestedTipOutAmount: number;
  tipOutAmount: number;
  remainingTipBalanceAmount: number;
  wasCapped: boolean;
};

type TipOutPostingResult = TipOutPreviewResult & {
  id: string;
  payrollPeriodId: string | null;
  staffMember: { id: string; displayName: string };
};

type PayrollDistributionPreview = {
  pool: {
    id: string;
    name: string;
    poolType: string;
  };
  payrollPeriod: {
    id: string;
    label: string | null;
    startDate: string;
    endDate: string;
  };
  poolTotal: number;
  totalHoursWorked: number;
  perHourRate: number;
  hoursEntries: Array<{
    staffMemberId: string;
    employeeName: string;
    hoursWorked: number;
  }>;
  allocations: Array<{
    staffMemberId: string;
    employeeName: string;
    hoursWorked: number;
    allocationAmount: number;
  }>;
};

type DistributionFormState = {
  poolId: string;
  payrollPeriodId: string;
  hoursByStaffId: Record<string, string>;
};

type ApiErrorResponse = {
  message?: string;
};

function percentageToDecimal(value: string) {
  return Number((Number(value || "0") / 100).toFixed(6));
}

function decimalToPercentage(value: number) {
  return Number((value * 100).toFixed(3)).toString();
}

function formatDateInput(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getStaffName(staff: StaffOption) {
  return staff.displayName ?? `${staff.firstName} ${staff.lastName}`;
}

function createEmptyRuleForm(defaultVenueId: string): TipOutRuleFormState {
  return {
    scope: "DEPARTMENT",
    venueId: defaultVenueId,
    departmentId: "",
    targetPoolId: "",
    name: "",
    description: "",
    ratePercentage: "1.5",
    capAtAvailableTipBalance: true,
    isActive: true,
  };
}

function createRuleFormFromRule(rule: TipOutRuleSummary): TipOutRuleFormState {
  return {
    scope: rule.scope,
    venueId: rule.venueId ?? "",
    departmentId: rule.departmentId ?? "",
    targetPoolId: rule.targetPoolId,
    name: rule.name,
    description: rule.description ?? "",
    ratePercentage: decimalToPercentage(rule.rateDecimal),
    capAtAvailableTipBalance: rule.capAtAvailableTipBalance,
    isActive: rule.isActive,
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

function ScopeBadge({ scope }: { scope: TipOutRuleSummary["scope"] }) {
  return (
    <span className="rounded-full border border-[#dcc8b2] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8a7667]">
      {scope === "CUSTOMER" ? "Customer default" : scope === "VENUE" ? "Venue default" : "Department override"}
    </span>
  );
}

export function CustomerTipOutRulesManager({
  rules,
  venues,
  departments,
  pools,
  staffMembers,
  payrollPeriods,
  defaultSelectedVenueId,
  canManage,
}: {
  rules: TipOutRuleSummary[];
  venues: VenueOption[];
  departments: DepartmentOption[];
  pools: PoolOption[];
  staffMembers: StaffOption[];
  payrollPeriods: PayrollPeriodOption[];
  defaultSelectedVenueId?: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialVenueId = defaultSelectedVenueId ?? venues[0]?.id ?? "";
  const [selectedVenueId, setSelectedVenueId] = useState(initialVenueId);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<TipOutRuleFormState>(() => createEmptyRuleForm(initialVenueId));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, TipOutRuleFormState>>(
    Object.fromEntries(rules.map((rule) => [rule.id, createRuleFormFromRule(rule)])),
  );
  const [previewForm, setPreviewForm] = useState<TipOutPreviewState>({
    tipOutRuleId: rules[0]?.id ?? "",
    venueId: initialVenueId,
    departmentId: departments.find((department) => department.venueId === initialVenueId && department.isActive)?.id ?? "",
    staffMemberId: staffMembers.find((staffMember) => staffMember.venueId === initialVenueId && staffMember.status === "ACTIVE")?.id ?? "",
    businessDate: formatDateInput(new Date()),
    totalSales: "2000",
    discounts: "50",
    availableTipBalance: "100",
  });
  const [previewResult, setPreviewResult] = useState<TipOutPreviewResult | null>(null);
  const [lastPosting, setLastPosting] = useState<TipOutPostingResult | null>(null);
  const [distributionForm, setDistributionForm] = useState<DistributionFormState>({
    poolId: pools.find((pool) => pool.venueId === initialVenueId && pool.status === "ACTIVE")?.id ?? "",
    payrollPeriodId: payrollPeriods[0]?.id ?? "",
    hoursByStaffId: {},
  });
  const [distributionPreview, setDistributionPreview] = useState<PayrollDistributionPreview | null>(null);

  const visibleRules = useMemo(
    () =>
      rules.filter(
        (rule) =>
          !selectedVenueId ||
          rule.scope === "CUSTOMER" ||
          rule.venueId === selectedVenueId,
      ),
    [rules, selectedVenueId],
  );

  const activeDepartmentsForVenue = useMemo(
    () =>
      departments.filter(
        (department) => department.venueId === (selectedVenueId || createForm.venueId) && department.isActive,
      ),
    [departments, selectedVenueId, createForm.venueId],
  );

  const poolsForVenue = useMemo(
    () => pools.filter((pool) => !selectedVenueId || pool.venueId === selectedVenueId),
    [pools, selectedVenueId],
  );

  const previewDepartments = useMemo(
    () => departments.filter((department) => department.venueId === previewForm.venueId && department.isActive),
    [departments, previewForm.venueId],
  );

  const previewStaff = useMemo(
    () => staffMembers.filter((staffMember) => staffMember.venueId === previewForm.venueId && staffMember.status === "ACTIVE"),
    [staffMembers, previewForm.venueId],
  );

  function setSuccess(nextMessage: string) {
    setMessage(nextMessage);
    setError(null);
    router.refresh();
  }

  function setFailure(nextError: unknown, fallback: string) {
    setError(nextError instanceof Error ? nextError.message : fallback);
  }

  function normalizeRulePayload(form: TipOutRuleFormState) {
    return {
      scope: form.scope,
      venueId: form.scope === "CUSTOMER" ? undefined : form.venueId || undefined,
      departmentId: form.scope === "DEPARTMENT" ? form.departmentId || undefined : undefined,
      targetPoolId: form.targetPoolId,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      rateDecimal: percentageToDecimal(form.ratePercentage),
      capAtAvailableTipBalance: form.capAtAvailableTipBalance,
      isActive: form.isActive,
    };
  }

  function updateCreateField(field: keyof TipOutRuleFormState, value: string | boolean) {
    setCreateForm((current) => {
      const next = { ...current, [field]: value } as TipOutRuleFormState;
      if (field === "scope" && value === "CUSTOMER") {
        next.venueId = "";
        next.departmentId = "";
      }
      if (field === "scope" && value === "VENUE") {
        next.departmentId = "";
      }
      if (field === "venueId") {
        next.departmentId = "";
        next.targetPoolId = "";
      }
      return next;
    });
  }

  function updateEditField(id: string, field: keyof TipOutRuleFormState, value: string | boolean) {
    setEditForms((current) => {
      const existing = current[id];
      if (!existing) {
        return current;
      }
      const next = { ...existing, [field]: value } as TipOutRuleFormState;
      if (field === "scope" && value === "CUSTOMER") {
        next.venueId = "";
        next.departmentId = "";
      }
      if (field === "scope" && value === "VENUE") {
        next.departmentId = "";
      }
      if (field === "venueId") {
        next.departmentId = "";
        next.targetPoolId = "";
      }
      return { ...current, [id]: next };
    });
  }

  function handleCreate() {
    startTransition(async () => {
      try {
        await sendJson<{ data: TipOutRuleSummary }>("/api/v1/customer-admin/tip-out-rules", {
          method: "POST",
          body: JSON.stringify(normalizeRulePayload(createForm)),
        });
        setCreateForm(createEmptyRuleForm(initialVenueId));
        setSuccess("Tip-out rule created.");
      } catch (createError) {
        setFailure(createError, "Unable to create tip-out rule");
      }
    });
  }

  function handleUpdate(ruleId: string) {
    const form = editForms[ruleId];
    if (!form) {
      return;
    }

    startTransition(async () => {
      try {
        await sendJson<{ data: TipOutRuleSummary }>(`/api/v1/customer-admin/tip-out-rules/${ruleId}`, {
          method: "PATCH",
          body: JSON.stringify(normalizeRulePayload(form)),
        });
        setEditingId(null);
        setSuccess("Tip-out rule updated.");
      } catch (updateError) {
        setFailure(updateError, "Unable to update tip-out rule");
      }
    });
  }

  function handleDelete(ruleId: string) {
    startTransition(async () => {
      try {
        await sendJson<{ data: { deleted: true } }>(`/api/v1/customer-admin/tip-out-rules/${ruleId}`, {
          method: "DELETE",
        });
        setSuccess("Tip-out rule deleted.");
      } catch (deleteError) {
        setFailure(deleteError, "Unable to delete tip-out rule");
      }
    });
  }

  function handlePreview() {
    startTransition(async () => {
      try {
        const response = await sendJson<{ data: TipOutPreviewResult }>("/api/v1/customer-admin/tip-out-rules/preview", {
          method: "POST",
          body: JSON.stringify({
            tipOutRuleId: previewForm.tipOutRuleId || undefined,
            venueId: previewForm.venueId,
            departmentId: previewForm.departmentId || undefined,
            staffMemberId: previewForm.staffMemberId,
            businessDate: previewForm.businessDate || undefined,
            totalSales: Number(previewForm.totalSales),
            discounts: Number(previewForm.discounts || "0"),
            availableTipBalance: Number(previewForm.availableTipBalance),
          }),
        });
        setPreviewResult(response.data);
        setLastPosting(null);
        setMessage("Tip-out preview updated.");
        setError(null);
      } catch (previewError) {
        setFailure(previewError, "Unable to preview tip-out");
      }
    });
  }

  function handlePostDeduction() {
    startTransition(async () => {
      try {
        const response = await sendJson<{ data: TipOutPostingResult }>("/api/v1/customer-admin/tip-out-rules/postings", {
          method: "POST",
          body: JSON.stringify({
            tipOutRuleId: previewForm.tipOutRuleId || undefined,
            venueId: previewForm.venueId,
            departmentId: previewForm.departmentId || undefined,
            staffMemberId: previewForm.staffMemberId,
            businessDate: previewForm.businessDate || undefined,
            totalSales: Number(previewForm.totalSales),
            discounts: Number(previewForm.discounts || "0"),
            availableTipBalance: Number(previewForm.availableTipBalance),
          }),
        });
        setLastPosting(response.data);
        setPreviewResult(response.data);
        setMessage("Tip-out deduction posted into the target pool.");
        setError(null);
        router.refresh();
      } catch (postingError) {
        setFailure(postingError, "Unable to post tip-out deduction");
      }
    });
  }

  function loadDistributionPreview() {
    if (!distributionForm.poolId || !distributionForm.payrollPeriodId) {
      setError("Choose a pool and payroll period first.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await sendJson<{ data: PayrollDistributionPreview }>(
          "/api/v1/customer-admin/tip-out-rules/payroll-distribution-preview",
          {
            method: "POST",
            body: JSON.stringify({
              poolId: distributionForm.poolId,
              payrollPeriodId: distributionForm.payrollPeriodId,
            }),
          },
        );
        setDistributionPreview(response.data);
        setDistributionForm((current) => ({
          ...current,
          hoursByStaffId: Object.fromEntries(
            response.data.hoursEntries.map((entry) => [entry.staffMemberId, entry.hoursWorked.toString()]),
          ),
        }));
        setMessage("Payroll distribution preview loaded.");
        setError(null);
      } catch (distributionError) {
        setFailure(distributionError, "Unable to load payroll distribution preview");
      }
    });
  }

  function saveManualHours() {
    if (!distributionForm.poolId || !distributionForm.payrollPeriodId) {
      setError("Choose a pool and payroll period first.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await sendJson<{ data: PayrollDistributionPreview }>(
          "/api/v1/customer-admin/tip-out-rules/manual-hours",
          {
            method: "POST",
            body: JSON.stringify({
              poolId: distributionForm.poolId,
              payrollPeriodId: distributionForm.payrollPeriodId,
              entries: Object.entries(distributionForm.hoursByStaffId).map(([staffMemberId, hoursWorked]) => ({
                staffMemberId,
                hoursWorked: Number(hoursWorked || "0"),
              })),
            }),
          },
        );
        setDistributionPreview(response.data);
        setMessage("Manual hours saved and payroll distribution recalculated.");
        setError(null);
        router.refresh();
      } catch (hoursError) {
        setFailure(hoursError, "Unable to save manual hours");
      }
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded-2xl border border-[#cfe4b8] bg-[#f4faea] px-4 py-3 text-sm text-[#496328]">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-[#f0c0b7] bg-[#fff4f1] px-4 py-3 text-sm text-[#8d3b2f]">{error}</p>
      ) : null}

      <section className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block min-w-[220px]">
            <FieldLabel>Visible venue</FieldLabel>
            <select
              value={selectedVenueId}
              onChange={(event) => setSelectedVenueId(event.target.value)}
              className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            >
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
          <p className="text-xs uppercase tracking-[0.26em] text-[#8d8d8d]">Tip-Out Rules</p>
          <h2 className="mt-2 text-2xl text-[#43362f]">Configure sales-based deductions</h2>
          <p className="mt-2 text-sm text-[#8a7667]">
            Store percentage rates as decimal fractions internally while showing friendly percentages to admins.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <FieldLabel>Scope</FieldLabel>
              <select
                value={createForm.scope}
                onChange={(event) => updateCreateField("scope", event.target.value)}
                disabled={!canManage || isPending}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              >
                <option value="CUSTOMER">Customer default</option>
                <option value="VENUE">Venue default</option>
                <option value="DEPARTMENT">Department override</option>
              </select>
            </label>

            <label className="block">
              <FieldLabel>Rate (%)</FieldLabel>
              <input
                value={createForm.ratePercentage}
                onChange={(event) => updateCreateField("ratePercentage", event.target.value)}
                disabled={!canManage || isPending}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              />
            </label>

            {createForm.scope !== "CUSTOMER" ? (
              <label className="block">
                <FieldLabel>Venue</FieldLabel>
                <select
                  value={createForm.venueId}
                  onChange={(event) => updateCreateField("venueId", event.target.value)}
                  disabled={!canManage || isPending}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                >
                  <option value="">Select venue</option>
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {createForm.scope === "DEPARTMENT" ? (
              <label className="block">
                <FieldLabel>Department</FieldLabel>
                <select
                  value={createForm.departmentId}
                  onChange={(event) => updateCreateField("departmentId", event.target.value)}
                  disabled={!canManage || isPending}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                >
                  <option value="">Select department</option>
                  {departments
                    .filter((department) => department.venueId === createForm.venueId && department.isActive)
                    .map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}

            <label className="block">
              <FieldLabel>Target pool</FieldLabel>
              <select
                value={createForm.targetPoolId}
                onChange={(event) => updateCreateField("targetPoolId", event.target.value)}
                disabled={!canManage || isPending}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              >
                <option value="">Select pool</option>
                {pools
                  .filter((pool) => !createForm.venueId || pool.venueId === createForm.venueId)
                  .filter((pool) => pool.status === "ACTIVE")
                  .map((pool) => (
                    <option key={pool.id} value={pool.id}>
                      {pool.name} ({pool.poolType})
                    </option>
                  ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <FieldLabel>Rule name</FieldLabel>
              <input
                value={createForm.name}
                onChange={(event) => updateCreateField("name", event.target.value)}
                disabled={!canManage || isPending}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              />
            </label>

            <label className="block md:col-span-2">
              <FieldLabel>Description</FieldLabel>
              <textarea
                value={createForm.description}
                onChange={(event) => updateCreateField("description", event.target.value)}
                disabled={!canManage || isPending}
                rows={3}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              />
            </label>

            <label className="flex items-center gap-3 text-sm text-[#5f5045]">
              <input
                type="checkbox"
                checked={createForm.capAtAvailableTipBalance}
                onChange={(event) => updateCreateField("capAtAvailableTipBalance", event.target.checked)}
                disabled={!canManage || isPending}
              />
              Cap at available eligible tip balance
            </label>

            <label className="flex items-center gap-3 text-sm text-[#5f5045]">
              <input
                type="checkbox"
                checked={createForm.isActive}
                onChange={(event) => updateCreateField("isActive", event.target.checked)}
                disabled={!canManage || isPending}
              />
              Rule is active
            </label>
          </div>

          {canManage ? (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleCreate}
                disabled={isPending}
                className="rounded-full border border-[#b49e89] bg-[#b49e89] px-5 py-3 text-sm font-semibold text-[#fffaf4] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Saving..." : "Create rule"}
              </button>
            </div>
          ) : null}
        </article>

        <article className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
          <p className="text-xs uppercase tracking-[0.26em] text-[#8d8d8d]">Worked Example</p>
          <h2 className="mt-2 text-2xl text-[#43362f]">1.5% means 0.015 internally</h2>
          <div className="mt-6 rounded-[1.4rem] border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] p-5 text-sm leading-7 text-[#5f5045]">
            <p>Total sales: 2000</p>
            <p>Discounts: 50</p>
            <p>Net sales: 1950</p>
            <p>Rate stored internally: 0.015</p>
            <p className="font-semibold text-[#43362f]">Tip-out amount: 29.25</p>
          </div>
        </article>
      </section>

      <section className="space-y-4">
        {visibleRules.map((rule) => {
          const form = editForms[rule.id];
          const isEditing = editingId === rule.id && !!form;
          const poolsForRule = pools.filter((pool) => !form?.venueId || pool.venueId === form.venueId);
          const departmentsForRule = departments.filter(
            (department) => department.venueId === form?.venueId && department.isActive,
          );

          return (
            <article
              key={rule.id}
              className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl text-[#43362f]">{rule.name}</h3>
                  <p className="mt-2 text-sm text-[#8a7667]">
                    {[rule.venue?.name, rule.department?.name].filter(Boolean).join(" / ") || "Customer-wide default"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <ScopeBadge scope={rule.scope} />
                  <span className="rounded-full border border-[#dcc8b2] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8a7667]">
                    {rule.ratePercentageLabel}
                  </span>
                  <span className="rounded-full border border-[#dcc8b2] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8a7667]">
                    {rule.targetPool?.name}
                  </span>
                </div>
              </div>

              {isEditing && form ? (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <FieldLabel>Scope</FieldLabel>
                    <select
                      value={form.scope}
                      onChange={(event) => updateEditField(rule.id, "scope", event.target.value)}
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    >
                      <option value="CUSTOMER">Customer default</option>
                      <option value="VENUE">Venue default</option>
                      <option value="DEPARTMENT">Department override</option>
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Rate (%)</FieldLabel>
                    <input
                      value={form.ratePercentage}
                      onChange={(event) => updateEditField(rule.id, "ratePercentage", event.target.value)}
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    />
                  </label>
                  {form.scope !== "CUSTOMER" ? (
                    <label className="block">
                      <FieldLabel>Venue</FieldLabel>
                      <select
                        value={form.venueId}
                        onChange={(event) => updateEditField(rule.id, "venueId", event.target.value)}
                        className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                      >
                        <option value="">Select venue</option>
                        {venues.map((venue) => (
                          <option key={venue.id} value={venue.id}>
                            {venue.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {form.scope === "DEPARTMENT" ? (
                    <label className="block">
                      <FieldLabel>Department</FieldLabel>
                      <select
                        value={form.departmentId}
                        onChange={(event) => updateEditField(rule.id, "departmentId", event.target.value)}
                        className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                      >
                        <option value="">Select department</option>
                        {departmentsForRule.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="block">
                    <FieldLabel>Target pool</FieldLabel>
                    <select
                      value={form.targetPoolId}
                      onChange={(event) => updateEditField(rule.id, "targetPoolId", event.target.value)}
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    >
                      <option value="">Select pool</option>
                      {poolsForRule
                        .filter((pool) => pool.status === "ACTIVE")
                        .map((pool) => (
                          <option key={pool.id} value={pool.id}>
                            {pool.name} ({pool.poolType})
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block md:col-span-2">
                    <FieldLabel>Name</FieldLabel>
                    <input
                      value={form.name}
                      onChange={(event) => updateEditField(rule.id, "name", event.target.value)}
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <FieldLabel>Description</FieldLabel>
                    <textarea
                      value={form.description}
                      onChange={(event) => updateEditField(rule.id, "description", event.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-3 text-sm text-[#5f5045]">
                    <input
                      type="checkbox"
                      checked={form.capAtAvailableTipBalance}
                      onChange={(event) => updateEditField(rule.id, "capAtAvailableTipBalance", event.target.checked)}
                    />
                    Cap at available eligible tip balance
                  </label>
                  <label className="flex items-center gap-3 text-sm text-[#5f5045]">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) => updateEditField(rule.id, "isActive", event.target.checked)}
                    />
                    Rule is active
                  </label>
                </div>
              ) : (
                <div className="mt-6 rounded-[1.4rem] border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] p-5 text-sm leading-7 text-[#5f5045]">
                  <p>{rule.description || "No description yet."}</p>
                  <p className="mt-2">Stored internally as decimal: {rule.rateDecimal.toFixed(6)}</p>
                  <p>Displayed to admins as: {rule.ratePercentageLabel}</p>
                  <p>Cap at eligible balance: {rule.capAtAvailableTipBalance ? "Yes" : "No"}</p>
                  <p>Status: {rule.isActive ? "Active" : "Inactive"}</p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                {canManage ? (
                  isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdate(rule.id)}
                        disabled={isPending}
                        className="rounded-full border border-[#b49e89] bg-[#b49e89] px-5 py-3 text-sm font-semibold text-[#fffaf4]"
                      >
                        Save rule
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-full border border-[#dcc8b2] bg-transparent px-5 py-3 text-sm font-semibold text-[#5f5045]"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingId(rule.id)}
                        className="rounded-full border border-[#dcc8b2] bg-transparent px-5 py-3 text-sm font-semibold text-[#5f5045]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(rule.id)}
                        className="rounded-full border border-[#f0c0b7] bg-transparent px-5 py-3 text-sm font-semibold text-[#d25d4d]"
                      >
                        Delete
                      </button>
                    </>
                  )
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
          <p className="text-xs uppercase tracking-[0.26em] text-[#8d8d8d]">Preview & Posting</p>
          <h2 className="mt-2 text-2xl text-[#43362f]">Server tip-out deduction</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <FieldLabel>Rule</FieldLabel>
              <select
                value={previewForm.tipOutRuleId}
                onChange={(event) => setPreviewForm((current) => ({ ...current, tipOutRuleId: event.target.value }))}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              >
                <option value="">Auto-resolve by scope</option>
                {visibleRules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.name} ({rule.scope})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Venue</FieldLabel>
              <select
                value={previewForm.venueId}
                onChange={(event) =>
                  setPreviewForm((current) => ({
                    ...current,
                    venueId: event.target.value,
                    departmentId:
                      departments.find((department) => department.venueId === event.target.value && department.isActive)?.id ?? "",
                    staffMemberId:
                      staffMembers.find((staffMember) => staffMember.venueId === event.target.value && staffMember.status === "ACTIVE")?.id ?? "",
                  }))
                }
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              >
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Department</FieldLabel>
              <select
                value={previewForm.departmentId}
                onChange={(event) => setPreviewForm((current) => ({ ...current, departmentId: event.target.value }))}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              >
                <option value="">No department</option>
                {previewDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Server</FieldLabel>
              <select
                value={previewForm.staffMemberId}
                onChange={(event) => setPreviewForm((current) => ({ ...current, staffMemberId: event.target.value }))}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              >
                {previewStaff.map((staffMember) => (
                  <option key={staffMember.id} value={staffMember.id}>
                    {getStaffName(staffMember)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Business date</FieldLabel>
              <input
                type="date"
                value={previewForm.businessDate}
                onChange={(event) => setPreviewForm((current) => ({ ...current, businessDate: event.target.value }))}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              />
            </label>
            <label className="block">
              <FieldLabel>Total sales</FieldLabel>
              <input
                value={previewForm.totalSales}
                onChange={(event) => setPreviewForm((current) => ({ ...current, totalSales: event.target.value }))}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              />
            </label>
            <label className="block">
              <FieldLabel>Discounts</FieldLabel>
              <input
                value={previewForm.discounts}
                onChange={(event) => setPreviewForm((current) => ({ ...current, discounts: event.target.value }))}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              />
            </label>
            <label className="block">
              <FieldLabel>Eligible tip balance</FieldLabel>
              <input
                value={previewForm.availableTipBalance}
                onChange={(event) =>
                  setPreviewForm((current) => ({ ...current, availableTipBalance: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={isPending}
              className="rounded-full border border-[#dcc8b2] bg-transparent px-5 py-3 text-sm font-semibold text-[#5f5045]"
            >
              Preview tip-out
            </button>
            {canManage ? (
              <button
                type="button"
                onClick={handlePostDeduction}
                disabled={isPending}
                className="rounded-full border border-[#b49e89] bg-[#b49e89] px-5 py-3 text-sm font-semibold text-[#fffaf4]"
              >
                Post deduction
              </button>
            ) : null}
          </div>

          {previewResult ? (
            <div className="mt-6 rounded-[1.4rem] border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] p-5 text-sm leading-7 text-[#5f5045]">
              <p>Applied rule: <span className="font-semibold text-[#43362f]">{previewResult.rule.name}</span></p>
              <p>Net sales: {formatCurrency(previewResult.netSales)}</p>
              <p>Rate: {previewResult.rule.ratePercentageLabel}</p>
              <p>Requested tip-out: {formatCurrency(previewResult.requestedTipOutAmount)}</p>
              <p>Deducted from server: {formatCurrency(previewResult.tipOutAmount)}</p>
              <p>Remaining eligible balance: {formatCurrency(previewResult.remainingTipBalanceAmount)}</p>
              <p>Transferred to pool: {previewResult.targetPool.name}</p>
              {previewResult.wasCapped ? <p className="text-[#8d3b2f]">The deduction was capped at the available tip balance.</p> : null}
              {lastPosting ? <p className="font-semibold text-[#496328]">Ledger posting saved.</p> : null}
            </div>
          ) : null}
        </article>

        <article className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
          <p className="text-xs uppercase tracking-[0.26em] text-[#8d8d8d]">Payroll Distribution</p>
          <h2 className="mt-2 text-2xl text-[#43362f]">Manual hours for the pool</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <FieldLabel>Target pool</FieldLabel>
              <select
                value={distributionForm.poolId}
                onChange={(event) => setDistributionForm((current) => ({ ...current, poolId: event.target.value }))}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              >
                <option value="">Select pool</option>
                {poolsForVenue
                  .filter((pool) => pool.status === "ACTIVE")
                  .map((pool) => (
                    <option key={pool.id} value={pool.id}>
                      {pool.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Payroll period</FieldLabel>
              <select
                value={distributionForm.payrollPeriodId}
                onChange={(event) =>
                  setDistributionForm((current) => ({ ...current, payrollPeriodId: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              >
                {payrollPeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.label ?? `${formatDateInput(period.startDate)} - ${formatDateInput(period.endDate)}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadDistributionPreview}
              disabled={isPending}
              className="rounded-full border border-[#dcc8b2] bg-transparent px-5 py-3 text-sm font-semibold text-[#5f5045]"
            >
              Load current hours
            </button>
            {canManage ? (
              <button
                type="button"
                onClick={saveManualHours}
                disabled={isPending}
                className="rounded-full border border-[#b49e89] bg-[#b49e89] px-5 py-3 text-sm font-semibold text-[#fffaf4]"
              >
                Save hours & preview
              </button>
            ) : null}
          </div>

          {distributionPreview ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.3rem] border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#8d8d8d]">Transferred</p>
                  <p className="mt-2 text-2xl text-[#43362f]">{formatCurrency(distributionPreview.poolTotal)}</p>
                </div>
                <div className="rounded-[1.3rem] border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#8d8d8d]">Total hours</p>
                  <p className="mt-2 text-2xl text-[#43362f]">{distributionPreview.totalHoursWorked.toFixed(2)}</p>
                </div>
                <div className="rounded-[1.3rem] border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#8d8d8d]">Per hour rate</p>
                  <p className="mt-2 text-2xl text-[#43362f]">{formatCurrency(distributionPreview.perHourRate)}</p>
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-[#8d8d8d]">Manual hours entry</p>
                <div className="mt-4 space-y-3">
                  {distributionPreview.hoursEntries.map((entry) => (
                    <div key={entry.staffMemberId} className="grid gap-3 md:grid-cols-[1fr_180px] md:items-center">
                      <p className="text-sm font-semibold text-[#43362f]">{entry.employeeName}</p>
                      <input
                        value={distributionForm.hoursByStaffId[entry.staffMemberId] ?? entry.hoursWorked.toString()}
                        onChange={(event) =>
                          setDistributionForm((current) => ({
                            ...current,
                            hoursByStaffId: {
                              ...current.hoursByStaffId,
                              [entry.staffMemberId]: event.target.value,
                            },
                          }))
                        }
                        className="rounded-2xl border px-4 py-3 text-sm outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-[#8d8d8d]">Allocations</p>
                <div className="mt-4 space-y-3">
                  {distributionPreview.allocations.map((allocation) => (
                    <div key={allocation.staffMemberId} className="flex items-center justify-between gap-4 text-sm text-[#5f5045]">
                      <span>{allocation.employeeName}</span>
                      <span>
                        {allocation.hoursWorked.toFixed(2)}h → <strong className="text-[#43362f]">{formatCurrency(allocation.allocationAmount)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
