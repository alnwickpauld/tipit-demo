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
  type: "MEETING_EVENTS" | "BREAKFAST" | "ROOM_SERVICE" | "BAR" | "RESTAURANT" | "OTHER";
};

type ServiceAreaSummary = {
  id: string;
  venueId: string;
  departmentId: string;
  name: string;
  slug: string;
  description: string | null;
  tippingMode: "TEAM_ONLY" | "INDIVIDUAL_ONLY" | "TEAM_OR_INDIVIDUAL" | "SHIFT_SELECTOR";
  displayMode:
    | "FIXED_SIGN"
    | "TABLE_CARD"
    | "BILL_FOLDER"
    | "COUNTER_SIGN"
    | "EVENT_SIGN"
    | "OTHER";
  isActive: boolean;
  publicTipUrl: string;
  venue: VenueOption;
  department: {
    id: string;
    name: string;
  };
};

type ServiceAreaFormState = {
  venueId: string;
  departmentId: string;
  name: string;
  slug: string;
  description: string;
  tippingMode: ServiceAreaSummary["tippingMode"];
  displayMode: ServiceAreaSummary["displayMode"];
  isActive: boolean;
};

type ApiErrorResponse = {
  message?: string;
};

const tippingModes: Array<{ value: ServiceAreaSummary["tippingMode"]; label: string }> = [
  { value: "TEAM_ONLY", label: "Team only" },
  { value: "INDIVIDUAL_ONLY", label: "Individual only" },
  { value: "TEAM_OR_INDIVIDUAL", label: "Team or individual" },
  { value: "SHIFT_SELECTOR", label: "Shift selector" },
];

const displayModes: Array<{ value: ServiceAreaSummary["displayMode"]; label: string }> = [
  { value: "FIXED_SIGN", label: "Fixed sign" },
  { value: "TABLE_CARD", label: "Table card" },
  { value: "BILL_FOLDER", label: "Bill folder" },
  { value: "COUNTER_SIGN", label: "Counter sign" },
  { value: "EVENT_SIGN", label: "Event sign" },
  { value: "OTHER", label: "Other" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function emptyServiceAreaForm(venueId = "", departmentId = ""): ServiceAreaFormState {
  return {
    venueId,
    departmentId,
    name: "",
    slug: "",
    description: "",
    tippingMode: "TEAM_ONLY",
    displayMode: "TABLE_CARD",
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

export function CustomerServiceAreasManager({
  serviceAreas,
  venues,
  departments,
  canManage,
}: {
  serviceAreas: ServiceAreaSummary[];
  venues: VenueOption[];
  departments: DepartmentOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [createForm, setCreateForm] = useState<ServiceAreaFormState>(
    emptyServiceAreaForm(venues[0]?.id ?? "", departments[0]?.id ?? ""),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, ServiceAreaFormState>>(
    Object.fromEntries(
      serviceAreas.map((serviceArea) => [
        serviceArea.id,
        {
          venueId: serviceArea.venueId,
          departmentId: serviceArea.departmentId,
          name: serviceArea.name,
          slug: serviceArea.slug,
          description: serviceArea.description ?? "",
          tippingMode: serviceArea.tippingMode,
          displayMode: serviceArea.displayMode,
          isActive: serviceArea.isActive,
        },
      ]),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleServiceAreas = serviceAreas.filter((serviceArea) => {
    const matchesVenue = !selectedVenueId || serviceArea.venueId === selectedVenueId;
    const matchesSearch = `${serviceArea.name} ${serviceArea.department.name} ${serviceArea.venue.name}`
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesVenue && matchesSearch;
  });

  const departmentsByVenue = useMemo(() => {
    return venues.map((venue) => ({
      venueId: venue.id,
      departments: departments.filter((department) => department.venueId === venue.id),
    }));
  }, [departments, venues]);

  function availableDepartments(venueId: string) {
    return departmentsByVenue.find((group) => group.venueId === venueId)?.departments ?? [];
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

  function updateCreateField(field: keyof ServiceAreaFormState, value: string | boolean) {
    setCreateForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !current.slug) {
        next.slug = slugify(String(value));
      }
      if (field === "venueId") {
        next.departmentId = availableDepartments(String(value))[0]?.id ?? "";
      }
      return next;
    });
  }

  function updateEditField(
    serviceAreaId: string,
    field: keyof ServiceAreaFormState,
    value: string | boolean,
  ) {
    setEditForms((current) => {
      const existing = current[serviceAreaId] ?? emptyServiceAreaForm();
      const next = { ...existing, [field]: value };
      if (field === "name" && !existing.slug) {
        next.slug = slugify(String(value));
      }
      if (field === "venueId") {
        next.departmentId = availableDepartments(String(value))[0]?.id ?? "";
      }
      return { ...current, [serviceAreaId]: next };
    });
  }

  function normalizeForm(form: ServiceAreaFormState) {
    return {
      venueId: form.venueId,
      departmentId: form.departmentId,
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description.trim() || undefined,
      tippingMode: form.tippingMode,
      displayMode: form.displayMode,
      isActive: form.isActive,
    };
  }

  function handleCreate() {
    startTransition(async () => {
      try {
        await sendJson("/api/v1/customer-admin/service-areas", {
          method: "POST",
          body: JSON.stringify(normalizeForm(createForm)),
        });
        const nextVenueId = createForm.venueId || venues[0]?.id || "";
        setCreateForm(
          emptyServiceAreaForm(nextVenueId, availableDepartments(nextVenueId)[0]?.id || ""),
        );
        refreshWithNotice("Service area created.");
      } catch (createError) {
        setError(
          createError instanceof Error ? createError.message : "Unable to create service area",
        );
      }
    });
  }

  function handleUpdate(serviceAreaId: string) {
    startTransition(async () => {
      try {
        await sendJson(`/api/v1/customer-admin/service-areas/${serviceAreaId}`, {
          method: "PATCH",
          body: JSON.stringify(normalizeForm(editForms[serviceAreaId] ?? emptyServiceAreaForm())),
        });
        setEditingId(null);
        refreshWithNotice("Service area updated.");
      } catch (updateError) {
        setError(
          updateError instanceof Error ? updateError.message : "Unable to update service area",
        );
      }
    });
  }

  function handleToggle(serviceArea: ServiceAreaSummary) {
    startTransition(async () => {
      try {
        await sendJson(`/api/v1/customer-admin/service-areas/${serviceArea.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: !serviceArea.isActive }),
        });
        refreshWithNotice(`Service area ${serviceArea.isActive ? "deactivated" : "activated"}.`);
      } catch (toggleError) {
        setError(
          toggleError instanceof Error ? toggleError.message : "Unable to update service area",
        );
      }
    });
  }

  function handleDelete(serviceArea: ServiceAreaSummary) {
    if (
      !window.confirm(
        `Delete ${serviceArea.name}? This only works when it has no linked tip history.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await sendJson(`/api/v1/customer-admin/service-areas/${serviceArea.id}`, {
          method: "DELETE",
        });
        refreshWithNotice("Service area deleted.");
      } catch (deleteError) {
        setError(
          deleteError instanceof Error ? deleteError.message : "Unable to delete service area",
        );
      }
    });
  }

  return (
    <section className="customer-admin-manager space-y-6">
      <div className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
        <p className="text-xs uppercase tracking-[0.26em] text-[#8c7a6c]">Service Areas</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl text-[#45372f]">Tipping touchpoints</h2>
            <p className="mt-1 text-sm text-[#7f6c5f]">
              Manage QR touchpoints like table cards, bill folders, fixed signs, and event areas.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Search service areas</FieldLabel>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by service area"
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
              <select value={createForm.venueId} onChange={(event) => updateCreateField("venueId", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none">
                {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Department</FieldLabel>
              <select value={createForm.departmentId} onChange={(event) => updateCreateField("departmentId", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none">
                {availableDepartments(createForm.venueId).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Name</FieldLabel>
              <input value={createForm.name} onChange={(event) => updateCreateField("name", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none" />
            </label>
            <label className="block">
              <FieldLabel>Slug</FieldLabel>
              <input value={createForm.slug} onChange={(event) => updateCreateField("slug", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none" />
            </label>
            <label className="block">
              <FieldLabel>Tipping mode</FieldLabel>
              <select value={createForm.tippingMode} onChange={(event) => updateCreateField("tippingMode", event.target.value as ServiceAreaSummary["tippingMode"])} className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none">
                {tippingModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Display mode</FieldLabel>
              <select value={createForm.displayMode} onChange={(event) => updateCreateField("displayMode", event.target.value as ServiceAreaSummary["displayMode"])} className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none">
                {displayModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
              </select>
            </label>
            <label className="block md:col-span-2 xl:col-span-4">
              <FieldLabel>Description</FieldLabel>
              <textarea rows={3} value={createForm.description} onChange={(event) => updateCreateField("description", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none" />
            </label>
          </div>
          <button type="button" onClick={handleCreate} disabled={isPending} className="mt-5 rounded-full border border-[#b49e89] bg-[#b49e89] px-6 py-3 text-sm font-semibold text-[#fffaf4] transition disabled:cursor-not-allowed disabled:opacity-60">
            Add service area
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        {visibleServiceAreas.map((serviceArea) => {
          const form = editForms[serviceArea.id] ?? emptyServiceAreaForm(serviceArea.venueId, serviceArea.departmentId);
          const isEditing = editingId === serviceArea.id;

          return (
            <article key={serviceArea.id} className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-5 shadow-[0_18px_40px_rgba(96,71,49,0.10)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-[#45372f]">{serviceArea.name}</h3>
                  <p className="mt-1 text-sm text-[#7f6c5f]">{serviceArea.department.name} / {serviceArea.venue.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#d5c3af] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#7e6a59]">{serviceArea.displayMode.replaceAll("_", " ")}</span>
                  <button type="button" onClick={() => setEditingId(isEditing ? null : serviceArea.id)} className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-sm font-medium text-[#43362f]">{isEditing ? "Close" : "Edit"}</button>
                  {canManage ? (
                    <>
                      <button type="button" onClick={() => handleToggle(serviceArea)} className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-sm font-medium text-[#43362f]">{serviceArea.isActive ? "Deactivate" : "Activate"}</button>
                      <button type="button" onClick={() => handleDelete(serviceArea)} className="rounded-full border border-[#f0b3a6] px-4 py-2 text-sm font-medium text-[#ff5d47]">Delete</button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 rounded-[1.4rem] border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c7a6c]">Public tip URL</p>
                <p className="mt-2 break-all text-sm text-[#43362f]">{serviceArea.publicTipUrl}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={() => handleCopy(serviceArea.publicTipUrl, serviceArea.name)} className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-sm font-medium text-[#43362f]">Copy URL</button>
                  <button type="button" onClick={() => window.open(serviceArea.publicTipUrl, "_blank", "noopener,noreferrer")} className="rounded-full border border-[#ccb8a5] bg-[rgba(255,251,246,0.96)] px-4 py-2 text-sm font-medium text-[#43362f]">Open tip page</button>
                </div>
              </div>

              {isEditing && canManage ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <FieldLabel>Venue</FieldLabel>
                    <select value={form.venueId} onChange={(event) => updateEditField(serviceArea.id, "venueId", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none">
                      {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Department</FieldLabel>
                    <select value={form.departmentId} onChange={(event) => updateEditField(serviceArea.id, "departmentId", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none">
                      {availableDepartments(form.venueId).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Name</FieldLabel>
                    <input value={form.name} onChange={(event) => updateEditField(serviceArea.id, "name", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none" />
                  </label>
                  <label className="block">
                    <FieldLabel>Slug</FieldLabel>
                    <input value={form.slug} onChange={(event) => updateEditField(serviceArea.id, "slug", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none" />
                  </label>
                  <label className="block">
                    <FieldLabel>Tipping mode</FieldLabel>
                    <select value={form.tippingMode} onChange={(event) => updateEditField(serviceArea.id, "tippingMode", event.target.value as ServiceAreaSummary["tippingMode"])} className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none">
                      {tippingModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Display mode</FieldLabel>
                    <select value={form.displayMode} onChange={(event) => updateEditField(serviceArea.id, "displayMode", event.target.value as ServiceAreaSummary["displayMode"])} className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none">
                      {displayModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                    </select>
                  </label>
                  <label className="block md:col-span-2">
                    <FieldLabel>Description</FieldLabel>
                    <textarea rows={3} value={form.description} onChange={(event) => updateEditField(serviceArea.id, "description", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none" />
                  </label>
                  <div className="md:col-span-2">
                    <button type="button" onClick={() => handleUpdate(serviceArea.id)} disabled={isPending} className="rounded-full bg-[#f3d312] px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60">
                      Save changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.4rem] border border-[#2f2f2f] bg-[#070707] p-4">
                  <p className="text-sm text-white">{serviceArea.description || "No description set."}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-[#bdbdbd]">
                    <span>Tipping: {serviceArea.tippingMode.replaceAll("_", " ")}</span>
                    <span>Status: {serviceArea.isActive ? "ACTIVE" : "INACTIVE"}</span>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
