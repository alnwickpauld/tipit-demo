"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useState, useTransition } from "react";

type VenueSummary = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  type: string | null;
  timezone: string | null;
  status: "ACTIVE" | "INACTIVE";
  city: string | null;
  country: string | null;
  brandBackgroundColor: string;
  brandTextColor: string;
  brandButtonColor: string;
  brandButtonTextColor: string;
  brandLogoImageUrl: string | null;
  _count: {
    staffMembers: number;
    pools: number;
    allocationRules: number;
  };
};

type VenueFormState = {
  name: string;
  slug: string;
  code: string;
  type: string;
  timezone: string;
  city: string;
  country: string;
  address: string;
  brandBackgroundColor: string;
  brandTextColor: string;
  brandButtonColor: string;
  brandButtonTextColor: string;
  brandLogoImageUrl: string;
};

type ApiErrorResponse = {
  message?: string;
};

const venueTypes = [
  { value: "", label: "Select type" },
  { value: "HOTEL_BAR", label: "Hotel bar" },
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "CAFE", label: "Cafe" },
  { value: "HOSPITALITY_SUITE", label: "Hospitality suite" },
  { value: "EVENT_SPACE", label: "Event space" },
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

function emptyVenueForm(): VenueFormState {
  return {
    name: "",
    slug: "",
    code: "",
    type: "",
    timezone: "Europe/London",
    city: "",
    country: "GB",
    address: "",
    brandBackgroundColor: "#ECECEC",
    brandTextColor: "#111111",
    brandButtonColor: "#000000",
    brandButtonTextColor: "#FFFFFF",
    brandLogoImageUrl: "",
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

export function CustomerVenuesManager({
  venues,
  canManage,
}: {
  venues: VenueSummary[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [createForm, setCreateForm] = useState<VenueFormState>(emptyVenueForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, VenueFormState>>(
    Object.fromEntries(
      venues.map((venue) => [
        venue.id,
        {
          name: venue.name,
          slug: venue.slug,
          code: venue.code ?? "",
          type: venue.type ?? "",
          timezone: venue.timezone ?? "Europe/London",
          city: venue.city ?? "",
          country: venue.country ?? "GB",
          address: "",
          brandBackgroundColor: venue.brandBackgroundColor,
          brandTextColor: venue.brandTextColor,
          brandButtonColor: venue.brandButtonColor,
          brandButtonTextColor: venue.brandButtonTextColor,
          brandLogoImageUrl: venue.brandLogoImageUrl ?? "",
        },
      ]),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleVenues = venues.filter((venue) =>
    `${venue.name} ${venue.code ?? ""} ${venue.city ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  function refreshWithNotice(nextMessage: string) {
    setMessage(nextMessage);
    setError(null);
    router.refresh();
  }

  function updateCreateField(field: keyof VenueFormState, value: string) {
    setCreateForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !current.slug) {
        next.slug = slugify(value);
      }
      return next;
    });
  }

  function updateEditField(id: string, field: keyof VenueFormState, value: string) {
    setEditForms((current) => {
      const existing = current[id] ?? emptyVenueForm();
      const next = { ...existing, [field]: value };
      if (field === "name" && !existing.slug) {
        next.slug = slugify(value);
      }
      return { ...current, [id]: next };
    });
  }

  async function handleLogoFileChange(
    target: "create" | { venueId: string },
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const result = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Unable to read image file."));
      reader.readAsDataURL(file);
    });

    if (target === "create") {
      updateCreateField("brandLogoImageUrl", result);
      return;
    }

    updateEditField(target.venueId, "brandLogoImageUrl", result);
  }

  function normalizeForm(form: VenueFormState) {
    return {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      code: form.code.trim() || undefined,
      type: form.type || undefined,
      timezone: form.timezone.trim() || undefined,
      city: form.city.trim() || undefined,
      country: form.country.trim() || undefined,
      address: form.address.trim() || undefined,
      brandBackgroundColor: form.brandBackgroundColor.trim() || undefined,
      brandTextColor: form.brandTextColor.trim() || undefined,
      brandButtonColor: form.brandButtonColor.trim() || undefined,
      brandButtonTextColor: form.brandButtonTextColor.trim() || undefined,
      brandLogoImageUrl: form.brandLogoImageUrl.trim() || null,
    };
  }

  function handleCreate() {
    startTransition(async () => {
      try {
        const payload = normalizeForm(createForm);
        await sendJson("/api/v1/customer-admin/venues", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setCreateForm(emptyVenueForm());
        refreshWithNotice("Venue created.");
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Unable to create venue");
      }
    });
  }

  function handleUpdate(venueId: string) {
    startTransition(async () => {
      try {
        const payload = normalizeForm(editForms[venueId] ?? emptyVenueForm());
        await sendJson(`/api/v1/customer-admin/venues/${venueId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setEditingId(null);
        refreshWithNotice("Venue updated.");
      } catch (updateError) {
        setError(updateError instanceof Error ? updateError.message : "Unable to update venue");
      }
    });
  }

  function handleStatusToggle(venue: VenueSummary) {
    const nextStatus = venue.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    startTransition(async () => {
      try {
        await sendJson(`/api/v1/customer-admin/venues/${venue.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        });
        refreshWithNotice(`Venue ${nextStatus === "ACTIVE" ? "activated" : "deactivated"}.`);
      } catch (statusError) {
        setError(
          statusError instanceof Error ? statusError.message : "Unable to update venue status",
        );
      }
    });
  }

  function handleDelete(venue: VenueSummary) {
    if (
      !window.confirm(
        `Delete ${venue.name}? This only works when the venue has no linked operational or reporting data.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await sendJson(`/api/v1/customer-admin/venues/${venue.id}`, {
          method: "DELETE",
          body: JSON.stringify({}),
        });
        refreshWithNotice("Venue deleted.");
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Unable to delete venue");
      }
    });
  }

  return (
    <section className="customer-admin-manager space-y-6">
      <div className="rounded-[1.8rem] border border-[#151515] bg-[#090909] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
        <p className="text-xs uppercase tracking-[0.26em] text-[#70809b]">Venues</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl text-white">Customer venues</h2>
            <p className="mt-1 text-sm text-[#9b9b9b]">
              Add, edit, deactivate, or safely delete venues from the customer workspace.
            </p>
          </div>
          <label className="block">
            <FieldLabel>Search venues</FieldLabel>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by venue name"
              className="mt-2 w-full min-w-[240px] rounded-2xl border border-[#3f3f3f] bg-[#0b0b0b] px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-[#666]"
            />
          </label>
        </div>

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
      </div>

      {canManage ? (
        <div className="rounded-[1.8rem] border border-[#151515] bg-[#090909] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            <label className="block">
              <FieldLabel>Code</FieldLabel>
              <input
                value={createForm.code}
                onChange={(event) => updateCreateField("code", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
            <label className="block">
              <FieldLabel>Type</FieldLabel>
              <select
                value={createForm.type}
                onChange={(event) => updateCreateField("type", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              >
                {venueTypes.map((option) => (
                  <option key={option.value || "blank"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Timezone</FieldLabel>
              <input
                value={createForm.timezone}
                onChange={(event) => updateCreateField("timezone", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
            <label className="block">
              <FieldLabel>City</FieldLabel>
              <input
                value={createForm.city}
                onChange={(event) => updateCreateField("city", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
            <label className="block">
              <FieldLabel>Country</FieldLabel>
              <input
                value={createForm.country}
                onChange={(event) => updateCreateField("country", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
            <label className="block md:col-span-2 xl:col-span-1">
              <FieldLabel>Address</FieldLabel>
              <input
                value={createForm.address}
                onChange={(event) => updateCreateField("address", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
              />
            </label>
            <label className="block">
              <FieldLabel>Background colour</FieldLabel>
              <input
                type="color"
                value={createForm.brandBackgroundColor}
                onChange={(event) => updateCreateField("brandBackgroundColor", event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-2 py-2"
              />
            </label>
            <label className="block">
              <FieldLabel>Text colour</FieldLabel>
              <input
                type="color"
                value={createForm.brandTextColor}
                onChange={(event) => updateCreateField("brandTextColor", event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-2 py-2"
              />
            </label>
            <label className="block">
              <FieldLabel>Button colour</FieldLabel>
              <input
                type="color"
                value={createForm.brandButtonColor}
                onChange={(event) => updateCreateField("brandButtonColor", event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-2 py-2"
              />
            </label>
            <label className="block">
              <FieldLabel>Button text colour</FieldLabel>
              <input
                type="color"
                value={createForm.brandButtonTextColor}
                onChange={(event) => updateCreateField("brandButtonTextColor", event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-2 py-2"
              />
            </label>
            <label className="block md:col-span-2 xl:col-span-2">
              <FieldLabel>Logo image</FieldLabel>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) => void handleLogoFileChange("create", event)}
                className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none file:mr-4 file:rounded-full file:border-0 file:bg-[#111111] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              {createForm.brandLogoImageUrl ? (
                <div className="mt-3 rounded-2xl border border-[#d8deea] bg-white p-3">
                  <img
                    src={createForm.brandLogoImageUrl}
                    alt="Venue logo preview"
                    className="h-12 w-auto max-w-[220px] object-contain"
                  />
                </div>
              ) : null}
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={isPending}
              onClick={handleCreate}
              className="rounded-full border border-[#f5d31d] bg-[#f5d31d] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add venue
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4">
        {visibleVenues.map((venue) => {
          const form = editForms[venue.id] ?? emptyVenueForm();
          const isEditing = editingId === venue.id;

          return (
            <article
              key={venue.id}
              className="rounded-[1.8rem] border border-[#2f2f2f] bg-[#090909] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-semibold text-white">{venue.name}</h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        venue.status === "ACTIVE"
                          ? "bg-[#eef7ef] text-[#1f5f33]"
                          : "bg-[#f2f4f7] text-[#66748b]"
                      }`}
                    >
                      {venue.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#b5b5b5]">
                    {venue.code ?? venue.slug}
                    {venue.city ? ` · ${venue.city}` : ""}
                    {venue.country ? ` · ${venue.country}` : ""}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className="rounded-full border border-[#3a3a3a] px-3 py-1 text-xs"
                      style={{
                        backgroundColor: venue.brandBackgroundColor,
                        color: venue.brandTextColor,
                      }}
                    >
                      Background
                    </span>
                    <span
                      className="rounded-full border border-[#3a3a3a] px-3 py-1 text-xs"
                      style={{
                        backgroundColor: venue.brandButtonColor,
                        color: venue.brandButtonTextColor,
                      }}
                    >
                      Button
                    </span>
                    {venue.brandLogoImageUrl ? (
                      <span className="rounded-full border border-[#3a3a3a] px-3 py-1 text-xs text-white">
                        Logo uploaded
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-[#d0d0d0]">
                    {venue._count.staffMembers} staff · {venue._count.pools} pools · {venue._count.allocationRules} rules
                  </p>
                </div>

                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : venue.id)}
                      className="rounded-full border border-[#4a4a4a] bg-[#0b0b0b] px-4 py-2 text-sm font-semibold text-white"
                    >
                      {isEditing ? "Close" : "Edit"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleStatusToggle(venue)}
                      className="rounded-full border border-[#4a4a4a] bg-[#0b0b0b] px-4 py-2 text-sm font-semibold text-white"
                    >
                      {venue.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDelete(venue)}
                      className="rounded-full border border-[#f2c9c5] px-4 py-2 text-sm font-semibold text-[#9f2d20]"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>

              {isEditing ? (
                <div className="mt-5 grid gap-4 border-t border-[#2a2a2a] pt-5 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block">
                    <FieldLabel>Name</FieldLabel>
                    <input
                      value={form.name}
                      onChange={(event) => updateEditField(venue.id, "name", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Slug</FieldLabel>
                    <input
                      value={form.slug}
                      onChange={(event) => updateEditField(venue.id, "slug", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Code</FieldLabel>
                    <input
                      value={form.code}
                      onChange={(event) => updateEditField(venue.id, "code", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Type</FieldLabel>
                    <select
                      value={form.type}
                      onChange={(event) => updateEditField(venue.id, "type", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                    >
                      {venueTypes.map((option) => (
                        <option key={option.value || "blank"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Timezone</FieldLabel>
                    <input
                      value={form.timezone}
                      onChange={(event) => updateEditField(venue.id, "timezone", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>City</FieldLabel>
                    <input
                      value={form.city}
                      onChange={(event) => updateEditField(venue.id, "city", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Country</FieldLabel>
                    <input
                      value={form.country}
                      onChange={(event) => updateEditField(venue.id, "country", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Address</FieldLabel>
                    <input
                      value={form.address}
                      onChange={(event) => updateEditField(venue.id, "address", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Background colour</FieldLabel>
                    <input
                      type="color"
                      value={form.brandBackgroundColor}
                      onChange={(event) => updateEditField(venue.id, "brandBackgroundColor", event.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-2 py-2"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Text colour</FieldLabel>
                    <input
                      type="color"
                      value={form.brandTextColor}
                      onChange={(event) => updateEditField(venue.id, "brandTextColor", event.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-2 py-2"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Button colour</FieldLabel>
                    <input
                      type="color"
                      value={form.brandButtonColor}
                      onChange={(event) => updateEditField(venue.id, "brandButtonColor", event.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-2 py-2"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Button text colour</FieldLabel>
                    <input
                      type="color"
                      value={form.brandButtonTextColor}
                      onChange={(event) => updateEditField(venue.id, "brandButtonTextColor", event.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-2 py-2"
                    />
                  </label>
                  <label className="block md:col-span-2 xl:col-span-2">
                    <FieldLabel>Logo image</FieldLabel>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(event) => void handleLogoFileChange({ venueId: venue.id }, event)}
                      className="mt-2 w-full rounded-2xl border border-[#d8deea] bg-[#fbfcfe] px-4 py-3 text-sm text-[#172033] outline-none file:mr-4 file:rounded-full file:border-0 file:bg-[#111111] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                    />
                    {form.brandLogoImageUrl ? (
                      <div className="mt-3 rounded-2xl border border-[#d8deea] bg-white p-3">
                        <img
                          src={form.brandLogoImageUrl}
                          alt={`${venue.name} logo preview`}
                          className="h-12 w-auto max-w-[220px] object-contain"
                        />
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => updateEditField(venue.id, "brandLogoImageUrl", "")}
                      className="mt-3 rounded-full border border-[#4a4a4a] bg-[#0b0b0b] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Remove logo
                    </button>
                  </label>

                  <div className="flex justify-end md:col-span-2 xl:col-span-4">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleUpdate(venue.id)}
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

        {visibleVenues.length === 0 ? (
          <div className="rounded-[1.8rem] border border-dashed border-[#2a2a2a] bg-[#090909] p-8 text-center text-sm text-[#9b9b9b]">
            No venues match this search.
          </div>
        ) : null}
      </div>
    </section>
  );
}

