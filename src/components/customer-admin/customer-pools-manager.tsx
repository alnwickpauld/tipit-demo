"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type VenueOption = {
  id: string;
  name: string;
};

type StaffOption = {
  id: string;
  venueId: string;
  displayName: string | null;
  firstName: string;
  lastName: string;
  status: "ACTIVE" | "INACTIVE";
};

type PoolSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  publicTipUrl: string;
  venueId: string;
  venue: VenueOption;
  members: Array<{
    id: string;
    isActive: boolean;
    staffMemberId: string;
    staffMember: {
      firstName: string;
      lastName: string;
      displayName: string | null;
    };
  }>;
};

type PoolFormState = {
  venueId: string;
  name: string;
  slug: string;
  description: string;
  memberStaffIds: string[];
};

type DistributionPreviewState = {
  poolTotal: string;
  staffHours: Record<string, string>;
};

type DistributionPreview = {
  poolId: string;
  poolName: string;
  poolTotal: number;
  totalHoursWorked: number;
  perHourRate: number;
  allocations: Array<{
    staffMemberId: string;
    employeeName: string;
    hoursWorked: number;
    allocationAmount: number;
  }>;
};

type ApiErrorResponse = {
  message?: string;
};

function emptyPoolForm(venueId = ""): PoolFormState {
  return {
    venueId,
    name: "",
    slug: "",
    description: "",
    memberStaffIds: [],
  };
}

function emptyDistributionPreviewState(pool: PoolSummary): DistributionPreviewState {
  return {
    poolTotal: "",
    staffHours: Object.fromEntries(
      pool.members.filter((member) => member.isActive).map((member) => [member.staffMemberId, ""]),
    ),
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
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

function getStaffName(staff: StaffOption | PoolSummary["members"][number]["staffMember"]) {
  return staff.displayName ?? `${staff.firstName} ${staff.lastName}`;
}

export function CustomerPoolsManager({
  pools,
  venues,
  staffMembers,
  defaultSelectedVenueId,
  canManage,
}: {
  pools: PoolSummary[];
  venues: VenueOption[];
  staffMembers: StaffOption[];
  defaultSelectedVenueId?: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState(defaultSelectedVenueId ?? "");
  const initialVenueId = defaultSelectedVenueId ?? venues[0]?.id ?? "";
  const [createForm, setCreateForm] = useState<PoolFormState>(emptyPoolForm(initialVenueId));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, PoolFormState>>(
    Object.fromEntries(
      pools.map((pool) => [
        pool.id,
        {
          venueId: pool.venueId,
          name: pool.name,
          slug: pool.slug,
          description: pool.description ?? "",
          memberStaffIds: pool.members
            .filter((member) => member.isActive)
            .map((member) => member.staffMemberId),
        },
      ]),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewForms, setPreviewForms] = useState<Record<string, DistributionPreviewState>>(
    Object.fromEntries(pools.map((pool) => [pool.id, emptyDistributionPreviewState(pool)])),
  );
  const [previewResults, setPreviewResults] = useState<Record<string, DistributionPreview | null>>(
    Object.fromEntries(pools.map((pool) => [pool.id, null])),
  );

  const visiblePools = pools.filter((pool) => {
    const matchesVenue = !selectedVenueId || pool.venueId === selectedVenueId;
    const matchesSearch = `${pool.name} ${pool.venue.name}`.toLowerCase().includes(search.toLowerCase());
    return matchesVenue && matchesSearch;
  });

  const groupedStaff = useMemo(() => {
    return venues.map((venue) => ({
      venue,
      staff: staffMembers
        .filter((member) => member.venueId === venue.id && member.status === "ACTIVE")
        .sort((a, b) => getStaffName(a).localeCompare(getStaffName(b))),
    }));
  }, [staffMembers, venues]);

  function normalizeForm(form: PoolFormState) {
    return {
      venueId: form.venueId,
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description.trim() || undefined,
      memberStaffIds: form.memberStaffIds,
    };
  }

  function refreshWithNotice(nextMessage: string) {
    setMessage(nextMessage);
    setError(null);
    router.refresh();
  }

  function handleCopy(url: string, label: string) {
    startTransition(async () => {
      try {
        await navigator.clipboard.writeText(url);
        setMessage(`${label} URL copied.`);
        setError(null);
      } catch {
        setError("Unable to copy the public URL");
      }
    });
  }

  function updateCreateField(field: keyof PoolFormState, value: string | string[]) {
    setCreateForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !current.slug) {
        next.slug = slugify(String(value));
      }
      if (field === "venueId") {
        next.memberStaffIds = [];
      }
      return next;
    });
  }

  function updateEditField(id: string, field: keyof PoolFormState, value: string | string[]) {
    setEditForms((current) => {
      const existing = current[id] ?? emptyPoolForm();
      const next = { ...existing, [field]: value };
      if (field === "name" && !existing.slug) {
        next.slug = slugify(String(value));
      }
      if (field === "venueId") {
        next.memberStaffIds = [];
      }
      return { ...current, [id]: next };
    });
  }

  function toggleMember(
    target: "create" | { id: string },
    staffMemberId: string,
    checked: boolean,
  ) {
    if (target === "create") {
      updateCreateField(
        "memberStaffIds",
        checked
          ? [...createForm.memberStaffIds, staffMemberId]
          : createForm.memberStaffIds.filter((id) => id !== staffMemberId),
      );
      return;
    }

    const currentForm = editForms[target.id] ?? emptyPoolForm();
    updateEditField(
      target.id,
      "memberStaffIds",
      checked
        ? [...currentForm.memberStaffIds, staffMemberId]
        : currentForm.memberStaffIds.filter((id) => id !== staffMemberId),
    );
  }

  function availableStaffForVenue(venueId: string) {
    return groupedStaff.find((group) => group.venue.id === venueId)?.staff ?? [];
  }

  function activeMembersForPool(pool: PoolSummary) {
    return pool.members.filter((member) => member.isActive);
  }

  function updatePreviewField(pool: PoolSummary, value: string) {
    setPreviewForms((current) => {
      const existing = current[pool.id] ?? emptyDistributionPreviewState(pool);
      return {
        ...current,
        [pool.id]: {
          ...existing,
          poolTotal: value,
        },
      };
    });
  }

  function updatePreviewHours(pool: PoolSummary, staffMemberId: string, value: string) {
    setPreviewForms((current) => {
      const existing = current[pool.id] ?? emptyDistributionPreviewState(pool);
      return {
        ...current,
        [pool.id]: {
          ...existing,
          staffHours: {
            ...existing.staffHours,
            [staffMemberId]: value,
          },
        },
      };
    });
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function handleCreate() {
    startTransition(async () => {
      try {
        await sendJson("/api/v1/customer-admin/pools", {
          method: "POST",
          body: JSON.stringify(normalizeForm(createForm)),
        });
        setCreateForm(emptyPoolForm(createForm.venueId || venues[0]?.id || ""));
        refreshWithNotice("Pool created.");
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Unable to create pool");
      }
    });
  }

  function handleUpdate(poolId: string) {
    startTransition(async () => {
      try {
        await sendJson(`/api/v1/customer-admin/pools/${poolId}`, {
          method: "PATCH",
          body: JSON.stringify(normalizeForm(editForms[poolId] ?? emptyPoolForm())),
        });
        setEditingId(null);
        refreshWithNotice("Pool updated.");
      } catch (updateError) {
        setError(updateError instanceof Error ? updateError.message : "Unable to update pool");
      }
    });
  }

  function handleStatusToggle(pool: PoolSummary) {
    const nextStatus = pool.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    startTransition(async () => {
      try {
        await sendJson(`/api/v1/customer-admin/pools/${pool.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        });
        refreshWithNotice(`Pool ${nextStatus === "ACTIVE" ? "activated" : "deactivated"}.`);
      } catch (statusError) {
        setError(statusError instanceof Error ? statusError.message : "Unable to update pool status");
      }
    });
  }

  function handleDelete(pool: PoolSummary) {
    if (!window.confirm(`Delete ${pool.name}? This only works when the pool has no members or linked reporting history.`)) {
      return;
    }

    startTransition(async () => {
      try {
        await sendJson(`/api/v1/customer-admin/pools/${pool.id}`, {
          method: "DELETE",
        });
        refreshWithNotice("Pool deleted.");
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Unable to delete pool");
      }
    });
  }

  function handlePreview(pool: PoolSummary) {
    startTransition(async () => {
      try {
        const previewForm = previewForms[pool.id] ?? emptyDistributionPreviewState(pool);
        const payload = await sendJson<{ data: DistributionPreview }>(
          `/api/v1/customer-admin/pools/${pool.id}/distribution-preview`,
          {
            method: "POST",
            body: JSON.stringify({
              poolTotal: Number(previewForm.poolTotal || 0),
              staffHours: activeMembersForPool(pool).map((member) => ({
                staffMemberId: member.staffMemberId,
                hoursWorked: Number(previewForm.staffHours[member.staffMemberId] || 0),
              })),
            }),
          },
        );

        setPreviewResults((current) => ({
          ...current,
          [pool.id]: payload.data,
        }));
        setMessage(`Distribution preview updated for ${pool.name}.`);
        setError(null);
      } catch (previewError) {
        setError(previewError instanceof Error ? previewError.message : "Unable to preview distribution");
      }
    });
  }

  return (
    <section className="customer-admin-manager space-y-6">
      <div className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
        <p className="text-xs uppercase tracking-[0.26em] text-[#70809b]">Pools</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl text-[#101828]">Tip distribution pools</h2>
            <p className="mt-1 text-sm text-[#66748b]">
              Create pools, update membership, and manage activation from the customer workspace.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Search pools</FieldLabel>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by pool name"
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
            <label className="block">
              <FieldLabel>Venue</FieldLabel>
              <select
                value={selectedVenueId}
                onChange={(event) => setSelectedVenueId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              >
                <option value="">All venues</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {message ? <p className="mt-4 rounded-2xl bg-[#eef7ef] px-4 py-3 text-sm text-[#1f5f33]">{message}</p> : null}
        {error ? <p className="mt-4 rounded-2xl bg-[#fff1f0] px-4 py-3 text-sm text-[#9f2d20]">{error}</p> : null}
      </div>

      {canManage ? (
      <div className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <FieldLabel>Venue</FieldLabel>
              <select
                value={createForm.venueId}
                onChange={(event) => updateCreateField("venueId", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              >
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Name</FieldLabel>
              <input
                value={createForm.name}
                onChange={(event) => updateCreateField("name", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
            <label className="block">
              <FieldLabel>Slug</FieldLabel>
              <input
                value={createForm.slug}
                onChange={(event) => updateCreateField("slug", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
            <label className="block md:col-span-2 xl:col-span-1">
              <FieldLabel>Description</FieldLabel>
              <input
                value={createForm.description}
                onChange={(event) => updateCreateField("description", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
          </div>

          <div className="mt-4">
            <FieldLabel>Assign staff</FieldLabel>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {availableStaffForVenue(createForm.venueId).map((staffMember) => (
                <label
                  key={staffMember.id}
                  className="flex items-center gap-3 rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033]"
                >
                  <input
                    type="checkbox"
                    checked={createForm.memberStaffIds.includes(staffMember.id)}
                    onChange={(event) => toggleMember("create", staffMember.id, event.target.checked)}
                  />
                  <span>{getStaffName(staffMember)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={isPending}
              onClick={handleCreate}
            className="rounded-full border border-[#b49e89] bg-[#b49e89] px-5 py-3 text-sm font-semibold text-[#fffaf4] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add pool
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {visiblePools.map((pool) => {
          const isEditing = editingId === pool.id;
          const form = editForms[pool.id] ?? emptyPoolForm(pool.venueId);
          const activeMembers = activeMembersForPool(pool);
          const previewForm = previewForms[pool.id] ?? emptyDistributionPreviewState(pool);
          const previewResult = previewResults[pool.id];

          return (
            <article
              key={pool.id}
                className="rounded-[1.5rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-5 shadow-[0_24px_60px_rgba(96,71,49,0.10)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-[#43362f]">{pool.name}</p>
                  <div className="mt-3 rounded-2xl border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">
                      Public tip URL
                    </p>
                    <a
                      href={pool.publicTipUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block break-all text-sm font-medium text-[#43362f] underline decoration-[#b49e89] underline-offset-4"
                    >
                      {pool.publicTipUrl}
                    </a>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(pool.publicTipUrl, "Pool")}
                    className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-sm font-semibold text-[#43362f]"
                      >
                        Copy URL
                      </button>
                      <a
                        href={pool.publicTipUrl}
                        target="_blank"
                        rel="noreferrer"
                    className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-sm font-semibold text-[#43362f]"
                      >
                        Open tip page
                      </a>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-[#7f6c5f]">
                    {pool.venue.name} / {pool.status}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <span className="rounded-full bg-[#f7f9fc] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#4d5b72]">
                    {activeMembers.length} members
                  </span>
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingId(isEditing ? null : pool.id)}
                    className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-sm font-semibold text-[#43362f]"
                      >
                        {isEditing ? "Close" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusToggle(pool)}
                    className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-sm font-semibold text-[#43362f]"
                      >
                        {pool.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(pool)}
                        className="rounded-full border border-[#f2c9c5] px-4 py-2 text-sm font-semibold text-[#9f2d20]"
                      >
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {activeMembers.map((member) => (
                  <span
                    key={member.id}
                    className="rounded-full border border-[#d8deea] bg-[#fbfcfe] px-3 py-2 text-xs font-semibold text-[#223047]"
                  >
                    {getStaffName(member.staffMember)}
                  </span>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">
                      Distribution preview
                    </p>
                    <p className="mt-1 text-sm text-[#7f6c5f]">
                      Enter a pool total and manual hours to preview a payroll-ready split.
                    </p>
                  </div>
                  <label className="block min-w-[13rem]">
                    <FieldLabel>Pool total</FieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={previewForm.poolTotal}
                      onChange={(event) => updatePreviewField(pool, event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#d9c8b8] bg-[#fffaf4] px-4 py-3 text-sm text-[#43362f] outline-none"
                      placeholder="0.00"
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {activeMembers.map((member) => (
                    <label
                      key={member.id}
                      className="rounded-2xl border border-[#e3d6c8] bg-[#fffdf9] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#43362f]">
                            {getStaffName(member.staffMember)}
                          </p>
                          <p className="text-xs text-[#7f6c5f]">Active pool member</p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={previewForm.staffHours[member.staffMemberId] ?? ""}
                          onChange={(event) =>
                            updatePreviewHours(pool, member.staffMemberId, event.target.value)
                          }
                          className="w-28 rounded-xl border border-[#d9c8b8] bg-[#fffaf4] px-3 py-2 text-right text-sm text-[#43362f] outline-none"
                          placeholder="0"
                        />
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handlePreview(pool)}
                    className="rounded-full border border-[#b49e89] bg-[#b49e89] px-5 py-3 text-sm font-semibold text-[#fffaf4] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Preview split
                  </button>
                </div>

                {previewResult ? (
                  <div className="mt-4 rounded-2xl border border-[#e3d6c8] bg-[#fffdf9] p-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">
                          Pool total
                        </p>
                        <p className="mt-1 text-lg font-semibold text-[#43362f]">
                          {formatCurrency(previewResult.poolTotal)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">
                          Total hours
                        </p>
                        <p className="mt-1 text-lg font-semibold text-[#43362f]">
                          {previewResult.totalHoursWorked.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">
                          Per-hour rate
                        </p>
                        <p className="mt-1 text-lg font-semibold text-[#43362f]">
                          {formatCurrency(previewResult.perHourRate)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl border border-[#eadfd3]">
                      <div className="grid grid-cols-[minmax(0,1.4fr)_110px_130px] gap-3 bg-[#f8f1e9] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#7f6c5f]">
                        <span>Employee</span>
                        <span className="text-right">Hours</span>
                        <span className="text-right">Allocation</span>
                      </div>
                      {previewResult.allocations.map((allocation) => (
                        <div
                          key={allocation.staffMemberId}
                          className="grid grid-cols-[minmax(0,1.4fr)_110px_130px] gap-3 border-t border-[#f0e5da] px-4 py-3 text-sm text-[#43362f]"
                        >
                          <span>{allocation.employeeName}</span>
                          <span className="text-right">{allocation.hoursWorked.toFixed(2)}</span>
                          <span className="text-right font-semibold">
                            {formatCurrency(allocation.allocationAmount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {isEditing ? (
                <div className="mt-5 space-y-4 border-t border-[#e8edf5] pt-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <FieldLabel>Venue</FieldLabel>
                      <select
                        value={form.venueId}
                        onChange={(event) => updateEditField(pool.id, "venueId", event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                      >
                        {venues.map((venue) => (
                          <option key={venue.id} value={venue.id}>
                            {venue.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <FieldLabel>Name</FieldLabel>
                      <input
                        value={form.name}
                        onChange={(event) => updateEditField(pool.id, "name", event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Slug</FieldLabel>
                      <input
                        value={form.slug}
                        onChange={(event) => updateEditField(pool.id, "slug", event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Description</FieldLabel>
                      <input
                        value={form.description}
                        onChange={(event) => updateEditField(pool.id, "description", event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                      />
                    </label>
                  </div>

                  <div>
                    <FieldLabel>Assign staff</FieldLabel>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {availableStaffForVenue(form.venueId).map((staffMember) => (
                        <label
                          key={staffMember.id}
                          className="flex items-center gap-3 rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033]"
                        >
                          <input
                            type="checkbox"
                            checked={form.memberStaffIds.includes(staffMember.id)}
                            onChange={(event) =>
                              toggleMember({ id: pool.id }, staffMember.id, event.target.checked)
                            }
                          />
                          <span>{getStaffName(staffMember)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleUpdate(pool.id)}
                  className="rounded-full border border-[#b49e89] bg-[#b49e89] px-5 py-3 text-sm font-semibold text-[#fffaf4] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Save changes
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
