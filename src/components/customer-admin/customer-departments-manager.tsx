"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  formatRevenueCentreType,
  revenueCentreLabels,
  type RevenueCentreType,
} from "../../lib/revenue-centres";

type VenueOption = {
  id: string;
  name: string;
};

type DepartmentSummary = {
  id: string;
  venueId: string;
  name: string;
  slug: string;
  revenueCentreType: RevenueCentreType;
  description: string | null;
  isActive: boolean;
  venue: VenueOption;
  _count: {
    serviceAreas: number;
  };
};

type DepartmentFormState = {
  venueId: string;
  name: string;
  slug: string;
  revenueCentreType: DepartmentSummary["revenueCentreType"];
  description: string;
  isActive: boolean;
};

type ApiErrorResponse = {
  message?: string;
};

const revenueCentreOptions = Object.entries(revenueCentreLabels).map(([value, label]) => ({
  value: value as RevenueCentreType,
  label,
}));

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function emptyDepartmentForm(venueId = ""): DepartmentFormState {
  return {
    venueId,
    name: "",
    slug: "",
    revenueCentreType: "RESTAURANT",
    description: "",
    isActive: true,
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
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">
      {children}
    </span>
  );
}

export function CustomerDepartmentsManager({
  departments,
  venues,
  defaultSelectedVenueId,
  canManage,
}: {
  departments: DepartmentSummary[];
  venues: VenueOption[];
  defaultSelectedVenueId?: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState(defaultSelectedVenueId ?? "");
  const initialVenueId = defaultSelectedVenueId ?? venues[0]?.id ?? "";
  const [createForm, setCreateForm] = useState<DepartmentFormState>(emptyDepartmentForm(initialVenueId));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, DepartmentFormState>>(
    Object.fromEntries(
      departments.map((department) => [
        department.id,
        {
          venueId: department.venueId,
          name: department.name,
          slug: department.slug,
          revenueCentreType: department.revenueCentreType,
          description: department.description ?? "",
          isActive: department.isActive,
        },
      ]),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleDepartments = departments.filter((department) => {
    const matchesVenue = !selectedVenueId || department.venueId === selectedVenueId;
    const matchesSearch = `${department.name} ${department.revenueCentreType} ${department.venue.name}`
      .toLowerCase()
      .includes(search.toLowerCase());

    return department.isActive && matchesVenue && matchesSearch;
  });

  function refreshWithNotice(nextMessage: string) {
    setMessage(nextMessage);
    setError(null);
    router.refresh();
  }

  function updateCreateField(field: keyof DepartmentFormState, value: string | boolean) {
    setCreateForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !current.slug) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  }

  function updateEditField(
    departmentId: string,
    field: keyof DepartmentFormState,
    value: string | boolean,
  ) {
    setEditForms((current) => {
      const existing = current[departmentId] ?? emptyDepartmentForm();
      const next = { ...existing, [field]: value };
      if (field === "name" && !existing.slug) {
        next.slug = slugify(String(value));
      }
      return { ...current, [departmentId]: next };
    });
  }

  function normalizeForm(form: DepartmentFormState) {
    return {
      venueId: form.venueId,
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      revenueCentreType: form.revenueCentreType,
      description: form.description.trim() || undefined,
      isActive: form.isActive,
    };
  }

  function handleCreate() {
    startTransition(async () => {
      try {
        await sendJson("/api/v1/customer-admin/departments", {
          method: "POST",
          body: JSON.stringify(normalizeForm(createForm)),
        });
        setCreateForm(emptyDepartmentForm(createForm.venueId || venues[0]?.id || ""));
        refreshWithNotice("Department created.");
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Unable to create department");
      }
    });
  }

  function handleUpdate(departmentId: string) {
    startTransition(async () => {
      try {
        await sendJson(`/api/v1/customer-admin/departments/${departmentId}`, {
          method: "PATCH",
          body: JSON.stringify(normalizeForm(editForms[departmentId] ?? emptyDepartmentForm())),
        });
        setEditingId(null);
        refreshWithNotice("Department updated.");
      } catch (updateError) {
        setError(updateError instanceof Error ? updateError.message : "Unable to update department");
      }
    });
  }

  function handleToggle(department: DepartmentSummary) {
    startTransition(async () => {
      try {
        await sendJson(`/api/v1/customer-admin/departments/${department.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: !department.isActive }),
        });
        refreshWithNotice(`Department ${department.isActive ? "deactivated" : "activated"}.`);
      } catch (toggleError) {
        setError(toggleError instanceof Error ? toggleError.message : "Unable to update department");
      }
    });
  }

  function handleDelete(department: DepartmentSummary) {
    if (
      !window.confirm(
        `Delete ${department.name}? This only works when the department has no linked service areas.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await sendJson(`/api/v1/customer-admin/departments/${department.id}`, {
          method: "DELETE",
        });
        refreshWithNotice("Department deleted.");
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Unable to delete department");
      }
    });
  }

  return (
    <section className="customer-admin-manager space-y-6">
      <div className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
        <p className="text-xs uppercase tracking-[0.26em] text-[#8c7a6c]">Departments</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl text-[#45372f]">Operational departments</h2>
            <p className="mt-1 text-sm text-[#7f6c5f]">
              Group service touchpoints into operational areas like breakfast, bar, or room
              service.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Search departments</FieldLabel>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by department name"
                className="mt-2 w-full rounded-2xl border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-3 text-sm text-[#43362f] outline-none placeholder:text-[#9a8574]"
              />
            </label>
            <label className="block">
              <FieldLabel>Venue</FieldLabel>
              <select
                value={selectedVenueId}
                onChange={(event) => setSelectedVenueId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-3 text-sm text-[#43362f] outline-none"
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
        {message ? <p className="mt-4 rounded-2xl border border-[#cdd8c2] bg-[#f4f8ef] px-4 py-3 text-sm text-[#5f7c44]">{message}</p> : null}
        {error ? <p className="mt-4 rounded-2xl border border-[#dfc0b6] bg-[#fff2ee] px-4 py-3 text-sm text-[#9d5848]">{error}</p> : null}
      </div>

      {canManage ? (
        <div className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <FieldLabel>Venue</FieldLabel>
              <select value={createForm.venueId} onChange={(event) => updateCreateField("venueId", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-3 text-sm text-[#43362f] outline-none">
                {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Name</FieldLabel>
              <input value={createForm.name} onChange={(event) => updateCreateField("name", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-3 text-sm text-[#43362f] outline-none" />
            </label>
            <label className="block">
              <FieldLabel>Slug</FieldLabel>
              <input value={createForm.slug} onChange={(event) => updateCreateField("slug", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-3 text-sm text-[#43362f] outline-none" />
            </label>
            <label className="block">
              <FieldLabel>Revenue centre</FieldLabel>
              <select value={createForm.revenueCentreType} onChange={(event) => updateCreateField("revenueCentreType", event.target.value as DepartmentSummary["revenueCentreType"])} className="mt-2 w-full rounded-2xl border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-3 text-sm text-[#43362f] outline-none">
                {revenueCentreOptions.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <label className="block md:col-span-2 xl:col-span-4">
              <FieldLabel>Description</FieldLabel>
              <textarea value={createForm.description} onChange={(event) => updateCreateField("description", event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-3 text-sm text-[#43362f] outline-none" />
            </label>
          </div>

          <button type="button" onClick={handleCreate} disabled={isPending} className="mt-5 rounded-full border border-[#b49e89] bg-[#b49e89] px-6 py-3 text-sm font-semibold text-[#fffaf4] transition disabled:cursor-not-allowed disabled:opacity-60">
            Add department
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        {visibleDepartments.map((department) => {
          const form = editForms[department.id] ?? emptyDepartmentForm(department.venueId);
          const isEditing = editingId === department.id;

          return (
            <article key={department.id} className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-5 shadow-[0_18px_40px_rgba(96,71,49,0.10)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-[#45372f]">{department.name}</h3>
                  <p className="mt-1 text-sm text-[#7f6c5f]">{department.venue.name} / {formatRevenueCentreType(department.revenueCentreType)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#d5c3af] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#7e6a59]">{department._count.serviceAreas} service areas</span>
                  <button type="button" onClick={() => setEditingId(isEditing ? null : department.id)} className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-sm font-medium text-[#43362f]">{isEditing ? "Close" : "Edit"}</button>
                  {canManage ? (
                    <>
                      <button type="button" onClick={() => handleToggle(department)} className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-sm font-medium text-[#43362f]">{department.isActive ? "Deactivate" : "Activate"}</button>
                      <button type="button" onClick={() => handleDelete(department)} className="rounded-full border border-[#f0b3a6] px-4 py-2 text-sm font-medium text-[#ff5d47]">Delete</button>
                    </>
                  ) : null}
                </div>
              </div>

              {isEditing && canManage ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <FieldLabel>Name</FieldLabel>
                    <input value={form.name} onChange={(event) => updateEditField(department.id, "name", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-3 text-sm text-[#43362f] outline-none" />
                  </label>
                  <label className="block">
                    <FieldLabel>Slug</FieldLabel>
                    <input value={form.slug} onChange={(event) => updateEditField(department.id, "slug", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-3 text-sm text-[#43362f] outline-none" />
                  </label>
                  <label className="block">
                    <FieldLabel>Venue</FieldLabel>
                    <select value={form.venueId} onChange={(event) => updateEditField(department.id, "venueId", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-3 text-sm text-[#43362f] outline-none">
                      {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Revenue centre</FieldLabel>
                    <select value={form.revenueCentreType} onChange={(event) => updateEditField(department.id, "revenueCentreType", event.target.value as DepartmentSummary["revenueCentreType"])} className="mt-2 w-full rounded-2xl border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-3 text-sm text-[#43362f] outline-none">
                      {revenueCentreOptions.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </label>
                  <label className="block md:col-span-2">
                    <FieldLabel>Description</FieldLabel>
                    <textarea rows={3} value={form.description} onChange={(event) => updateEditField(department.id, "description", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-3 text-sm text-[#43362f] outline-none" />
                  </label>
                  <div className="md:col-span-2">
                    <button type="button" onClick={() => handleUpdate(department.id)} disabled={isPending} className="rounded-full border border-[#b49e89] bg-[#b49e89] px-6 py-3 text-sm font-semibold text-[#fffaf4] transition disabled:cursor-not-allowed disabled:opacity-60">
                      Save changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.4rem] border border-[#d9c8b8] bg-[rgba(246,239,230,0.88)] p-4">
                  <p className="text-sm text-[#5d4b3d]">{department.description || "No description set."}</p>
                  <p className="mt-3 text-sm text-[#8b7768]">Status: {department.isActive ? "ACTIVE" : "INACTIVE"}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
