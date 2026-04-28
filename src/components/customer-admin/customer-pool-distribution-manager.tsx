"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type VenueOption = {
  id: string;
  name: string;
};

type PoolOption = {
  id: string;
  name: string;
  poolType: "FOH" | "BOH" | "HYBRID";
  venueId: string;
};

type PayrollPeriodOption = {
  id: string;
  label: string | null;
  startDate: Date | string;
  endDate: Date | string;
};

type EligibleEmployee = {
  employeeId: string;
  employeeName: string;
  payrollReference: string | null;
  hoursWorked: number;
  source: "MANUAL" | "CSV_IMPORT" | "INTEGRATION";
  status: "DRAFT" | "LOCKED";
};

type AllocationRow = {
  employeeId: string;
  employeeName: string;
  payrollReference: string | null;
  hoursWorked: number;
  allocationAmount: number;
  hoursSource: "MANUAL" | "CSV_IMPORT" | "INTEGRATION";
};

type DistributionState = {
  pool: {
    id: string;
    name: string;
    poolType: "FOH" | "BOH" | "HYBRID";
    venueId: string;
  };
  payrollPeriod: {
    id: string;
    label: string | null;
    startDate: string;
    endDate: string;
  };
  run: {
    id: string;
    status: "DRAFT" | "READY_FOR_REVIEW" | "LOCKED" | "EXPORTED";
    poolTotal: number;
    totalHours: number;
    perHourRate: number;
    roundingAdjustment: number;
  } | null;
  employees: EligibleEmployee[];
  allocations: AllocationRow[];
};

type PreviewResult = {
  runId: string;
  status: "READY_FOR_REVIEW" | "LOCKED";
  pool: DistributionState["pool"];
  payrollPeriod: DistributionState["payrollPeriod"];
  poolTotal: number;
  totalHours: number;
  perHourRate: number;
  roundingAdjustment: number;
  allocations: AllocationRow[];
};

type ApiErrorResponse = {
  message?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateRange(period: PayrollPeriodOption) {
  if (period.label) {
    return period.label;
  }

  const start = new Date(period.startDate).toLocaleDateString("en-GB");
  const end = new Date(period.endDate).toLocaleDateString("en-GB");
  return `${start} - ${end}`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">{children}</span>;
}

async function sendJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiErrorResponse;
    throw new Error(error.message ?? "Request failed");
  }

  return (await response.json()) as T;
}

export function CustomerPoolDistributionManager({
  venues,
  pools,
  payrollPeriods,
  defaultSelectedVenueId,
  defaultSelectedPoolId,
  defaultSelectedPayrollPeriodId,
  canManage,
  canUnlock,
}: {
  venues: VenueOption[];
  pools: PoolOption[];
  payrollPeriods: PayrollPeriodOption[];
  defaultSelectedVenueId: string;
  defaultSelectedPoolId: string;
  defaultSelectedPayrollPeriodId: string;
  canManage: boolean;
  canUnlock: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedVenueId, setSelectedVenueId] = useState(defaultSelectedVenueId);
  const [selectedPoolId, setSelectedPoolId] = useState(defaultSelectedPoolId);
  const [selectedPayrollPeriodId, setSelectedPayrollPeriodId] = useState(defaultSelectedPayrollPeriodId);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<DistributionState | null>(null);
  const [poolTotal, setPoolTotal] = useState("0");
  const [hoursByEmployeeId, setHoursByEmployeeId] = useState<Record<string, string>>({});

  const visiblePools = useMemo(
    () => pools.filter((pool) => !selectedVenueId || pool.venueId === selectedVenueId),
    [pools, selectedVenueId],
  );

  useEffect(() => {
    if (!visiblePools.some((pool) => pool.id === selectedPoolId)) {
      setSelectedPoolId(visiblePools[0]?.id ?? "");
    }
  }, [visiblePools, selectedPoolId]);

  useEffect(() => {
    if (!selectedPoolId || !selectedPayrollPeriodId) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await sendJson<{ data: DistributionState }>(
          `/api/v1/customer-admin/pool-distributions/eligible-employees?poolId=${encodeURIComponent(selectedPoolId)}&payrollPeriodId=${encodeURIComponent(selectedPayrollPeriodId)}`,
        );
        setState(response.data);
        setPoolTotal((response.data.run?.poolTotal ?? 0).toString());
        setHoursByEmployeeId(
          Object.fromEntries(
            response.data.employees.map((employee) => [employee.employeeId, employee.hoursWorked.toString()]),
          ),
        );
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load pool distribution");
      }
    });
  }, [selectedPoolId, selectedPayrollPeriodId]);

  function setSuccess(nextMessage: string) {
    setMessage(nextMessage);
    setError(null);
  }

  function currentEntries() {
    return (state?.employees ?? []).map((employee) => ({
      employeeId: employee.employeeId,
      hoursWorked: Number(hoursByEmployeeId[employee.employeeId] ?? employee.hoursWorked ?? 0),
      source: employee.source,
    }));
  }

  function saveHours() {
    startTransition(async () => {
      try {
        const response = await sendJson<{ data: DistributionState }>(
          "/api/v1/customer-admin/pool-distributions/hours",
          {
            method: "POST",
            body: JSON.stringify({
              poolId: selectedPoolId,
              payrollPeriodId: selectedPayrollPeriodId,
              poolTotal: Number(poolTotal || "0"),
              entries: currentEntries(),
            }),
          },
        );
        setState(response.data);
        setSuccess("Manual hours saved.");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save hours");
      }
    });
  }

  function previewDistribution() {
    startTransition(async () => {
      try {
        const response = await sendJson<{ data: PreviewResult }>(
          "/api/v1/customer-admin/pool-distributions/preview",
          {
            method: "POST",
            body: JSON.stringify({
              poolId: selectedPoolId,
              payrollPeriodId: selectedPayrollPeriodId,
              poolTotal: Number(poolTotal || "0"),
            }),
          },
        );
        setState((current) =>
          current
            ? {
                ...current,
                run: {
                  id: response.data.runId,
                  status: response.data.status,
                  poolTotal: response.data.poolTotal,
                  totalHours: response.data.totalHours,
                  perHourRate: response.data.perHourRate,
                  roundingAdjustment: response.data.roundingAdjustment,
                },
                allocations: response.data.allocations,
              }
            : current,
        );
        setPoolTotal(response.data.poolTotal.toString());
        setSuccess("Distribution preview updated.");
      } catch (previewError) {
        setError(previewError instanceof Error ? previewError.message : "Unable to preview distribution");
      }
    });
  }

  function lockDistribution() {
    startTransition(async () => {
      try {
        const response = await sendJson<{ data: PreviewResult }>(
          "/api/v1/customer-admin/pool-distributions/lock",
          {
            method: "POST",
            body: JSON.stringify({
              poolId: selectedPoolId,
              payrollPeriodId: selectedPayrollPeriodId,
              poolTotal: Number(poolTotal || "0"),
            }),
          },
        );
        setState((current) =>
          current
            ? {
                ...current,
                run: {
                  id: response.data.runId,
                  status: response.data.status,
                  poolTotal: response.data.poolTotal,
                  totalHours: response.data.totalHours,
                  perHourRate: response.data.perHourRate,
                  roundingAdjustment: response.data.roundingAdjustment,
                },
                employees: current.employees.map((employee) => ({ ...employee, status: "LOCKED" })),
                allocations: response.data.allocations,
              }
            : current,
        );
        setSuccess("Distribution locked for payroll export.");
      } catch (lockError) {
        setError(lockError instanceof Error ? lockError.message : "Unable to lock distribution");
      }
    });
  }

  function unlockDistribution() {
    if (!state?.run) {
      return;
    }
    const runId = state.run.id;

    startTransition(async () => {
      try {
        await sendJson<{ data: { id: string; unlocked: true } }>(
          `/api/v1/customer-admin/pool-distributions/${runId}/unlock`,
          {
            method: "POST",
          },
        );
        const refreshed = await sendJson<{ data: DistributionState }>(
          `/api/v1/customer-admin/pool-distributions/eligible-employees?poolId=${encodeURIComponent(selectedPoolId)}&payrollPeriodId=${encodeURIComponent(selectedPayrollPeriodId)}`,
        );
        setState(refreshed.data);
        setPoolTotal((refreshed.data.run?.poolTotal ?? 0).toString());
        setHoursByEmployeeId(
          Object.fromEntries(
            refreshed.data.employees.map((employee) => [employee.employeeId, employee.hoursWorked.toString()]),
          ),
        );
        setSuccess("Distribution unlocked.");
      } catch (unlockError) {
        setError(unlockError instanceof Error ? unlockError.message : "Unable to unlock distribution");
      }
    });
  }

  const selectedPool = visiblePools.find((pool) => pool.id === selectedPoolId) ?? null;
  const selectedPeriod = payrollPeriods.find((period) => period.id === selectedPayrollPeriodId) ?? null;
  const isLocked = state?.run?.status === "LOCKED" || state?.run?.status === "EXPORTED";

  return (
    <section className="space-y-6">
      <div className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
        <p className="text-xs uppercase tracking-[0.26em] text-[#8d8d8d]">Payroll</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl text-[#43362f]">Pool Distribution</h2>
            <p className="mt-1 text-sm text-[#8a7667]">
              Enter hours worked, preview the split, and lock a payroll-ready pool allocation.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <FieldLabel>Venue</FieldLabel>
              <select
                value={selectedVenueId}
                onChange={(event) => setSelectedVenueId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d9c8b8] bg-[#fffaf4] px-4 py-3 text-sm text-[#43362f] outline-none"
              >
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Pool</FieldLabel>
              <select
                value={selectedPoolId}
                onChange={(event) => setSelectedPoolId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d9c8b8] bg-[#fffaf4] px-4 py-3 text-sm text-[#43362f] outline-none"
              >
                {visiblePools.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name} ({pool.poolType})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Payroll period</FieldLabel>
              <select
                value={selectedPayrollPeriodId}
                onChange={(event) => setSelectedPayrollPeriodId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d9c8b8] bg-[#fffaf4] px-4 py-3 text-sm text-[#43362f] outline-none"
              >
                {payrollPeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {formatDateRange(period)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {message ? <p className="mt-4 rounded-2xl bg-[#eef7ef] px-4 py-3 text-sm text-[#1f5f33]">{message}</p> : null}
        {error ? <p className="mt-4 rounded-2xl bg-[#fff1f0] px-4 py-3 text-sm text-[#9f2d20]">{error}</p> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#8d8d8d]">Hours entry</p>
              <h3 className="mt-2 text-xl text-[#43362f]">
                {selectedPool?.name ?? "Select a pool"}
              </h3>
              {selectedPeriod ? (
                <p className="mt-1 text-sm text-[#8a7667]">{formatDateRange(selectedPeriod)}</p>
              ) : null}
            </div>
            <label className="block min-w-[14rem]">
              <FieldLabel>Pool total</FieldLabel>
              <input
                type="number"
                min="0"
                step="0.01"
                value={poolTotal}
                onChange={(event) => setPoolTotal(event.target.value)}
                disabled={isLocked}
                className="mt-2 w-full rounded-2xl border border-[#d9c8b8] bg-[#fffaf4] px-4 py-3 text-sm text-[#43362f] outline-none"
              />
            </label>
          </div>

          <div className="mt-5 overflow-x-auto rounded-[1.4rem] border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)]">
            <div className="grid grid-cols-[minmax(0,1.5fr)_180px_140px_120px] gap-3 border-b border-[#eadccf] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8d8d8d]">
              <span>Employee</span>
              <span>Payroll ref</span>
              <span>Hours</span>
              <span>Source</span>
            </div>
            {(state?.employees ?? []).map((employee) => (
              <div
                key={employee.employeeId}
                className="grid grid-cols-[minmax(0,1.5fr)_180px_140px_120px] gap-3 border-b border-[#f1e5d9] px-4 py-3 text-sm text-[#43362f] last:border-b-0"
              >
                <span>{employee.employeeName}</span>
                <span>{employee.payrollReference ?? "—"}</span>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={hoursByEmployeeId[employee.employeeId] ?? "0"}
                  onChange={(event) =>
                    setHoursByEmployeeId((current) => ({
                      ...current,
                      [employee.employeeId]: event.target.value,
                    }))
                  }
                  disabled={isLocked}
                  className="rounded-xl border border-[#d9c8b8] bg-[#fffaf4] px-3 py-2 text-right outline-none"
                />
                <span>{employee.source.replace("_", " ")}</span>
              </div>
            ))}
            {state?.employees.length === 0 ? (
              <p className="px-4 py-5 text-sm text-[#8a7667]">No eligible employees found for this pool in the selected payroll period.</p>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {canManage ? (
              <>
                <button
                  type="button"
                  onClick={saveHours}
                  disabled={isPending || isLocked}
                  className="rounded-full border border-[#b49e89] bg-[#b49e89] px-5 py-3 text-sm font-semibold text-[#fffaf4] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Save hours
                </button>
                <button
                  type="button"
                  onClick={previewDistribution}
                  disabled={isPending}
                  className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-5 py-3 text-sm font-semibold text-[#43362f]"
                >
                  Preview distribution
                </button>
                <button
                  type="button"
                  onClick={lockDistribution}
                  disabled={isPending || isLocked}
                  className="rounded-full border border-[#7d6a59] bg-[#7d6a59] px-5 py-3 text-sm font-semibold text-[#fffaf4] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Lock distribution
                </button>
              </>
            ) : null}
            {canUnlock && state?.run ? (
              <button
                type="button"
                onClick={unlockDistribution}
                disabled={isPending || !isLocked}
                className="rounded-full border border-[#f2c9c5] px-5 py-3 text-sm font-semibold text-[#9f2d20] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Unlock distribution
              </button>
            ) : null}
          </div>
        </article>

        <aside className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[1.4rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] px-5 py-5 shadow-[0_18px_40px_rgba(96,71,49,0.08)]">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8d8d8d]">Pool total</p>
              <p className="mt-2 text-2xl text-[#43362f]">
                {state?.run ? formatCurrency(state.run.poolTotal) : formatCurrency(Number(poolTotal || "0"))}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] px-5 py-5 shadow-[0_18px_40px_rgba(96,71,49,0.08)]">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8d8d8d]">Total hours</p>
              <p className="mt-2 text-2xl text-[#43362f]">{state?.run?.totalHours.toFixed(2) ?? "0.00"}</p>
            </div>
            <div className="rounded-[1.4rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] px-5 py-5 shadow-[0_18px_40px_rgba(96,71,49,0.08)]">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8d8d8d]">Per-hour rate</p>
              <p className="mt-2 text-2xl text-[#43362f]">{formatCurrency(state?.run?.perHourRate ?? 0)}</p>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
            <p className="text-xs uppercase tracking-[0.24em] text-[#8d8d8d]">Distribution status</p>
            <p className="mt-2 text-xl text-[#43362f]">{state?.run?.status ?? "DRAFT"}</p>
            <p className="mt-2 text-sm text-[#8a7667]">
              Rounding adjustment: {formatCurrency(state?.run?.roundingAdjustment ?? 0)}
            </p>
          </div>

          <div className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
            <p className="text-xs uppercase tracking-[0.24em] text-[#8d8d8d]">Preview allocations</p>
            <div className="mt-4 space-y-3">
              {(state?.allocations ?? []).map((allocation) => (
                <div
                  key={allocation.employeeId}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] px-4 py-3 text-sm text-[#43362f]"
                >
                  <div>
                    <p className="font-semibold">{allocation.employeeName}</p>
                    <p className="text-xs text-[#8a7667]">
                      {allocation.hoursWorked.toFixed(2)}h • {allocation.hoursSource.replace("_", " ")}
                    </p>
                  </div>
                  <strong>{formatCurrency(allocation.allocationAmount)}</strong>
                </div>
              ))}
              {(state?.allocations.length ?? 0) === 0 ? (
                <p className="text-sm text-[#8a7667]">Preview the distribution to see payroll-ready allocations.</p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
