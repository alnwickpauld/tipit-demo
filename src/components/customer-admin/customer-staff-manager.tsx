"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { RevenueCentreType } from "../../lib/revenue-centres";

type VenueOption = {
  id: string;
  name: string;
};

type DepartmentOption = {
  id: string;
  venueId: string;
  name: string;
  revenueCentreType: RevenueCentreType;
};

type StaffSummary = {
  id: string;
  venueId: string;
  departmentIds: string[];
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  staffCode: string | null;
  externalPayrollRef: string | null;
  status: "ACTIVE" | "INACTIVE";
  publicTipUrl: string;
  venue: VenueOption;
  departments: DepartmentOption[];
};

type StaffFormState = {
  venueId: string;
  departmentIds: string[];
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  staffCode: string;
  externalPayrollRef: string;
};

type ApiErrorResponse = {
  message?: string;
};

function emptyStaffForm(venueId = "", departmentIds: string[] = []): StaffFormState {
  return {
    venueId,
    departmentIds,
    firstName: "",
    lastName: "",
    displayName: "",
    email: "",
    staffCode: "",
    externalPayrollRef: "",
  };
}

function uniqueDepartmentIds(values: string[]) {
  return [...new Set(values)];
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

export function CustomerStaffManager({
  staffMembers,
  venues,
  departments,
  defaultSelectedVenueId,
  canManage,
}: {
  staffMembers: StaffSummary[];
  venues: VenueOption[];
  departments: DepartmentOption[];
  defaultSelectedVenueId?: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState(defaultSelectedVenueId ?? "");
  const initialVenueId = defaultSelectedVenueId ?? venues[0]?.id ?? "";
  const initialDepartmentIds = departments
    .filter((department) => department.venueId === initialVenueId)
    .slice(0, 1)
    .map((department) => department.id);
  const [createForm, setCreateForm] = useState<StaffFormState>(
    emptyStaffForm(initialVenueId, initialDepartmentIds),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, StaffFormState>>(
    Object.fromEntries(
      staffMembers.map((member) => [
        member.id,
        {
          venueId: member.venueId,
          departmentIds: member.departmentIds,
          firstName: member.firstName,
          lastName: member.lastName,
          displayName: member.displayName ?? "",
          email: member.email ?? "",
          staffCode: member.staffCode ?? "",
          externalPayrollRef: member.externalPayrollRef ?? "",
        },
      ]),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const departmentsByVenue = venues.map((venue) => ({
    venueId: venue.id,
    departments: departments.filter((department) => department.venueId === venue.id),
  }));

  const visibleStaff = staffMembers.filter((member) => {
    const matchesVenue = !selectedVenueId || member.venueId === selectedVenueId;
    const matchesSearch = `${member.firstName} ${member.lastName} ${member.displayName ?? ""} ${member.staffCode ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesVenue && matchesSearch;
  });

  function updateCreateField(field: Exclude<keyof StaffFormState, "departmentIds">, value: string) {
    setCreateForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "venueId") {
        const allowedDepartmentIds = new Set(
          (departmentsByVenue.find((group) => group.venueId === value)?.departments ?? []).map(
            (department) => department.id,
          ),
        );
        next.departmentIds = current.departmentIds.filter((departmentId) =>
          allowedDepartmentIds.has(departmentId),
        );
      }
      return next;
    });
  }

  function updateEditField(
    id: string,
    field: Exclude<keyof StaffFormState, "departmentIds">,
    value: string,
  ) {
    setEditForms((current) => {
      const existing = current[id] ?? emptyStaffForm();
      const next = {
        ...existing,
        [field]: value,
      };
      if (field === "venueId") {
        const allowedDepartmentIds = new Set(
          (departmentsByVenue.find((group) => group.venueId === value)?.departments ?? []).map(
            (department) => department.id,
          ),
        );
        next.departmentIds = existing.departmentIds.filter((departmentId) =>
          allowedDepartmentIds.has(departmentId),
        );
      }
      return {
        ...current,
        [id]: next,
      };
    });
  }

  function toggleDepartment(
    target: "create" | { id: string },
    departmentId: string,
    checked: boolean,
  ) {
    if (target === "create") {
      setCreateForm((current) => ({
        ...current,
        departmentIds: uniqueDepartmentIds(
          checked
            ? [...current.departmentIds, departmentId]
            : current.departmentIds.filter((id) => id !== departmentId),
        ),
      }));
      return;
    }

    setEditForms((current) => {
      const existing = current[target.id] ?? emptyStaffForm();
      return {
        ...current,
        [target.id]: {
          ...existing,
          departmentIds: uniqueDepartmentIds(
            checked
              ? [...existing.departmentIds, departmentId]
              : existing.departmentIds.filter((id) => id !== departmentId),
          ),
        },
      };
    });
  }

  function availableDepartments(venueId: string) {
    return departmentsByVenue.find((group) => group.venueId === venueId)?.departments ?? [];
  }

  function normalizeForm(form: StaffFormState) {
    return {
      venueId: form.venueId,
      departmentIds: form.departmentIds,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      displayName: form.displayName.trim() || undefined,
      email: form.email.trim() || undefined,
      staffCode: form.staffCode.trim() || undefined,
      externalPayrollRef: form.externalPayrollRef.trim() || undefined,
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

  function handleCreate() {
    startTransition(async () => {
      try {
        await sendJson("/api/v1/customer-admin/staff", {
          method: "POST",
          body: JSON.stringify(normalizeForm(createForm)),
        });
        const nextVenueId = createForm.venueId || venues[0]?.id || "";
        setCreateForm(emptyStaffForm(nextVenueId, []));
        refreshWithNotice("Staff member created.");
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Unable to create staff member");
      }
    });
  }

  function handleUpdate(staffMemberId: string) {
    startTransition(async () => {
      try {
        await sendJson(`/api/v1/customer-admin/staff/${staffMemberId}`, {
          method: "PATCH",
          body: JSON.stringify(normalizeForm(editForms[staffMemberId] ?? emptyStaffForm())),
        });
        setEditingId(null);
        refreshWithNotice("Staff member updated.");
      } catch (updateError) {
        setError(updateError instanceof Error ? updateError.message : "Unable to update staff member");
      }
    });
  }

  function handleStatusToggle(member: StaffSummary) {
    const nextStatus = member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    startTransition(async () => {
      try {
        await sendJson(`/api/v1/customer-admin/staff/${member.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        });
        refreshWithNotice(`Staff member ${nextStatus === "ACTIVE" ? "activated" : "deactivated"}.`);
      } catch (statusError) {
        setError(statusError instanceof Error ? statusError.message : "Unable to update staff status");
      }
    });
  }

  function handleDelete(member: StaffSummary) {
    if (!window.confirm(`Delete ${member.displayName ?? `${member.firstName} ${member.lastName}`}? This only works when they have no linked pool, rule, or reporting history.`)) {
      return;
    }

    startTransition(async () => {
      try {
        await sendJson(`/api/v1/customer-admin/staff/${member.id}`, {
          method: "DELETE",
          body: JSON.stringify({}),
        });
        refreshWithNotice("Staff member deleted.");
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Unable to delete staff member");
      }
    });
  }

  return (
    <section className="customer-admin-manager space-y-6">
      <div className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
        <p className="text-xs uppercase tracking-[0.26em] text-[#70809b]">Staff</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl text-white">Team directory</h2>
            <p className="mt-1 text-sm text-[#66748b]">
              Manage customer staff records without leaving the admin workspace.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Search staff</FieldLabel>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or code"
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
              <FieldLabel>First name</FieldLabel>
              <input
                value={createForm.firstName}
                onChange={(event) => updateCreateField("firstName", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
            <label className="block">
              <FieldLabel>Last name</FieldLabel>
              <input
                value={createForm.lastName}
                onChange={(event) => updateCreateField("lastName", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
            <label className="block">
              <FieldLabel>Display name</FieldLabel>
              <input
                value={createForm.displayName}
                onChange={(event) => updateCreateField("displayName", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
            <label className="block">
              <FieldLabel>Email</FieldLabel>
              <input
                value={createForm.email}
                onChange={(event) => updateCreateField("email", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
            <label className="block">
              <FieldLabel>Staff code</FieldLabel>
              <input
                value={createForm.staffCode}
                onChange={(event) => updateCreateField("staffCode", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
            <label className="block">
              <FieldLabel>Payroll ref</FieldLabel>
              <input
                value={createForm.externalPayrollRef}
                onChange={(event) => updateCreateField("externalPayrollRef", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
          </div>

          <div className="mt-4">
            <FieldLabel>Departments</FieldLabel>
            <div className="mt-3 flex flex-wrap gap-3">
              {availableDepartments(createForm.venueId).map((department) => {
                const checked = createForm.departmentIds.includes(department.id);

                return (
                  <label
                    key={department.id}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
                      checked
                      ? "border-[#b49e89] bg-[#eadfd3] text-[#43362f]"
                      : "border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] text-[#6f5f54]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => toggleDepartment("create", department.id, event.target.checked)}
                    className="h-4 w-4 accent-[#b49e89]"
                    />
                    <span>{department.name}</span>
                  </label>
                );
              })}
              {availableDepartments(createForm.venueId).length === 0 ? (
                <p className="text-sm text-[#8d8d8d]">No departments available for this venue.</p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={isPending}
              onClick={handleCreate}
            className="rounded-full border border-[#b49e89] bg-[#b49e89] px-5 py-3 text-sm font-semibold text-[#fffaf4] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add staff member
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4">
        {visibleStaff.map((member) => {
          const isEditing = editingId === member.id;
          const form = editForms[member.id] ?? emptyStaffForm(member.venueId, member.departmentIds);

          return (
            <article
              key={member.id}
                className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-semibold text-white">
                      {member.displayName ?? `${member.firstName} ${member.lastName}`}
                    </h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        member.status === "ACTIVE"
                          ? "border border-[#365118] bg-[#10190d] text-[#b6ef7b]"
                          : "border border-[#4a4a4a] bg-[#101010] text-[#c8c8c8]"
                      }`}
                    >
                      {member.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#d0d0d0]">
                    {member.venue.name}
                    {member.departments.length > 0
                      ? ` / ${member.departments.map((department) => department.name).join(", ")}`
                      : ""}
                  </p>
                  <div className="mt-3 rounded-2xl border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">
                      Public tip URL
                    </p>
                    <a
                      href={member.publicTipUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block break-all text-sm font-medium text-white underline decoration-[#4a4a4a] underline-offset-4"
                    >
                      {member.publicTipUrl}
                    </a>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(member.publicTipUrl, "Staff")}
                    className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-sm font-semibold text-[#43362f]"
                      >
                        Copy URL
                      </button>
                      <a
                        href={member.publicTipUrl}
                        target="_blank"
                        rel="noreferrer"
                    className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-sm font-semibold text-[#43362f]"
                      >
                        Open tip page
                      </a>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-[#d0d0d0]">
                    {member.email ?? "No email"} / {member.staffCode ?? "No staff code"} /{" "}
                    {member.externalPayrollRef ?? "No payroll ref"}
                  </p>
                </div>

                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : member.id)}
                    className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-sm font-semibold text-[#43362f]"
                    >
                      {isEditing ? "Close" : "Edit"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleStatusToggle(member)}
                    className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-sm font-semibold text-[#43362f]"
                    >
                      {member.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDelete(member)}
                      className="rounded-full border border-[#f2c9c5] px-4 py-2 text-sm font-semibold text-[#9f2d20]"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>

              {isEditing ? (
                <div className="mt-5 grid gap-4 border-t border-[#e8edf5] pt-5 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block">
                    <FieldLabel>Venue</FieldLabel>
                    <select
                      value={form.venueId}
                      onChange={(event) => updateEditField(member.id, "venueId", event.target.value)}
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
                    <FieldLabel>First name</FieldLabel>
                    <input
                      value={form.firstName}
                      onChange={(event) => updateEditField(member.id, "firstName", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Last name</FieldLabel>
                    <input
                      value={form.lastName}
                      onChange={(event) => updateEditField(member.id, "lastName", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Display name</FieldLabel>
                    <input
                      value={form.displayName}
                      onChange={(event) => updateEditField(member.id, "displayName", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Email</FieldLabel>
                    <input
                      value={form.email}
                      onChange={(event) => updateEditField(member.id, "email", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Staff code</FieldLabel>
                    <input
                      value={form.staffCode}
                      onChange={(event) => updateEditField(member.id, "staffCode", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Payroll ref</FieldLabel>
                    <input
                      value={form.externalPayrollRef}
                      onChange={(event) =>
                        updateEditField(member.id, "externalPayrollRef", event.target.value)
                      }
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                    />
                  </label>

                  <div className="md:col-span-2 xl:col-span-4">
                    <FieldLabel>Departments</FieldLabel>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {availableDepartments(form.venueId).map((department) => {
                        const checked = form.departmentIds.includes(department.id);

                        return (
                          <label
                            key={department.id}
                            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
                              checked
                      ? "border-[#b49e89] bg-[#eadfd3] text-[#43362f]"
                      : "border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] text-[#6f5f54]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                toggleDepartment({ id: member.id }, department.id, event.target.checked)
                              }
                    className="h-4 w-4 accent-[#b49e89]"
                            />
                            <span>{department.name}</span>
                          </label>
                        );
                      })}
                      {availableDepartments(form.venueId).length === 0 ? (
                        <p className="text-sm text-[#8d8d8d]">No departments available for this venue.</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="md:col-span-2 xl:col-span-4 flex justify-end">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleUpdate(member.id)}
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

        {visibleStaff.length === 0 ? (
        <div className="rounded-[1.8rem] border border-dashed border-[#d9c8b8] bg-[rgba(255,251,246,0.72)] p-8 text-center text-sm text-[#887568]">
            No staff members match this filter.
          </div>
        ) : null}
      </div>
    </section>
  );
}
