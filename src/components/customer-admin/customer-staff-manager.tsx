"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type VenueOption = {
  id: string;
  name: string;
};

type StaffSummary = {
  id: string;
  venueId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  staffCode: string | null;
  externalPayrollRef: string | null;
  status: "ACTIVE" | "INACTIVE";
  publicTipUrl: string;
  venue: VenueOption;
};

type StaffFormState = {
  venueId: string;
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

function emptyStaffForm(venueId = ""): StaffFormState {
  return {
    venueId,
    firstName: "",
    lastName: "",
    displayName: "",
    email: "",
    staffCode: "",
    externalPayrollRef: "",
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

export function CustomerStaffManager({
  staffMembers,
  venues,
  canManage,
}: {
  staffMembers: StaffSummary[];
  venues: VenueOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [createForm, setCreateForm] = useState<StaffFormState>(emptyStaffForm(venues[0]?.id ?? ""));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, StaffFormState>>(
    Object.fromEntries(
      staffMembers.map((member) => [
        member.id,
        {
          venueId: member.venueId,
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

  const visibleStaff = staffMembers.filter((member) => {
    const matchesVenue = !selectedVenueId || member.venueId === selectedVenueId;
    const matchesSearch = `${member.firstName} ${member.lastName} ${member.displayName ?? ""} ${member.staffCode ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesVenue && matchesSearch;
  });

  function updateCreateField(field: keyof StaffFormState, value: string) {
    setCreateForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditField(id: string, field: keyof StaffFormState, value: string) {
    setEditForms((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? emptyStaffForm()),
        [field]: value,
      },
    }));
  }

  function normalizeForm(form: StaffFormState) {
    return {
      venueId: form.venueId,
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
        setCreateForm(emptyStaffForm(createForm.venueId || venues[0]?.id || ""));
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
      <div className="rounded-[1.8rem] border border-[#151515] bg-[#090909] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
        <p className="text-xs uppercase tracking-[0.26em] text-[#70809b]">Staff</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl text-[#101828]">Team directory</h2>
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
        <div className="rounded-[1.8rem] border border-[#151515] bg-[#090909] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
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

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={isPending}
              onClick={handleCreate}
              className="rounded-full border border-[#f5d31d] bg-[#f5d31d] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add staff member
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4">
        {visibleStaff.map((member) => {
          const isEditing = editingId === member.id;
          const form = editForms[member.id] ?? emptyStaffForm(member.venueId);

          return (
            <article
              key={member.id}
              className="rounded-[1.8rem] border border-[#3f3f3f] bg-[#090909] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
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
                  <p className="mt-2 text-sm text-[#d0d0d0]">{member.venue.name}</p>
                  <div className="mt-3 rounded-2xl border border-[#4a4a4a] bg-[#0b0b0b] p-3">
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
                        className="rounded-full border border-[#4a4a4a] bg-[#0b0b0b] px-4 py-2 text-sm font-semibold text-white"
                      >
                        Copy URL
                      </button>
                      <a
                        href={member.publicTipUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-[#4a4a4a] bg-[#0b0b0b] px-4 py-2 text-sm font-semibold text-white"
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
                      className="rounded-full border border-[#4a4a4a] bg-[#0b0b0b] px-4 py-2 text-sm font-semibold text-white"
                    >
                      {isEditing ? "Close" : "Edit"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleStatusToggle(member)}
                      className="rounded-full border border-[#4a4a4a] bg-[#0b0b0b] px-4 py-2 text-sm font-semibold text-white"
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

                  <div className="md:col-span-2 xl:col-span-4 flex justify-end">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleUpdate(member.id)}
                      className="rounded-full border border-[#f5d31d] bg-[#f5d31d] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="rounded-[1.8rem] border border-dashed border-[#2a2a2a] bg-[#090909] p-8 text-center text-sm text-[#9b9b9b]">
            No staff members match this filter.
          </div>
        ) : null}
      </div>
    </section>
  );
}
