"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { BusinessToolbar } from "@/components/business/business-toolbar";
import { BusinessPagination } from "@/components/business/business-pagination";
import {
  archiveBusiness,
  createBusiness,
  restoreBusiness,
  updateBusiness,
} from "@/lib/businesses/actions";
import {
  BUSINESS_STATUSES,
  type Business,
  type BusinessInput,
  type BusinessStatus,
} from "@/lib/businesses/types";

/** Shared styling for native select/textarea so they match the Input component. */
const FIELD_CLASS =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

/** Local form state — all strings for controlled inputs. */
interface FormState {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  website: string;
  businessType: string;
  city: string;
  wilaya: string;
  country: string;
  status: BusinessStatus;
  brandsText: string;
  address: string;
  notes: string;
}

function emptyForm(): FormState {
  return {
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
    website: "",
    businessType: "",
    city: "",
    wilaya: "",
    country: "Algeria",
    status: "new",
    brandsText: "",
    address: "",
    notes: "",
  };
}

function formFromBusiness(b: Business): FormState {
  return {
    companyName: b.companyName,
    contactName: b.contactName ?? "",
    phone: b.phone ?? "",
    email: b.email ?? "",
    website: b.website ?? "",
    businessType: b.businessType ?? "",
    city: b.city ?? "",
    wilaya: b.wilaya ?? "",
    country: b.country ?? "Algeria",
    status: b.status,
    brandsText: b.supportedBrands.join(", "),
    address: b.address ?? "",
    notes: b.notes ?? "",
  };
}

/**
 * Labelled text input. Defined at module scope (not inside the form) so its
 * identity is stable across renders — otherwise each keystroke would remount
 * the input and drop focus.
 */
function TextField({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  required,
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  type?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  const id = `bf-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function formToInput(form: FormState): BusinessInput {
  return {
    companyName: form.companyName,
    contactName: form.contactName,
    phone: form.phone,
    email: form.email,
    website: form.website,
    businessType: form.businessType,
    city: form.city,
    wilaya: form.wilaya,
    country: form.country,
    status: form.status,
    supportedBrands: form.brandsText
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== ""),
    address: form.address,
    notes: form.notes,
  };
}

/**
 * Minimal manual CRUD for business records in the active workspace: list,
 * create, edit basic fields, and soft-delete (archive). Scoped entirely to the
 * passed workspaceId; the page remounts this on workspace switch (key=).
 *
 * Block 9: when `archived` is true this becomes the read/restore view — it lists
 * soft-deleted records and offers Restore instead of Edit/Archive, and the
 * create form is hidden.
 */
export function BusinessManager({
  workspaceId,
  businesses,
  total,
  page,
  pageCount,
  hasFilters,
  archived = false,
}: {
  workspaceId: string;
  businesses: Business[];
  /** Total rows matching the current filters (across all pages). */
  total: number;
  /** 1-based current page. */
  page: number;
  pageCount: number;
  /** Whether any search/filter is currently applied (affects empty-state copy). */
  hasFilters: boolean;
  /** Block 9: archived (restore) view vs the default active view. */
  archived?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // null = no form open; "new" = create form; otherwise the id being edited.
  const [openForm, setOpenForm] = useState<"new" | string | null>(null);

  function reset(msg: string) {
    setNotice(msg);
    setError(null);
    setOpenForm(null);
    router.refresh();
  }

  function handleCreate(form: FormState) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await createBusiness(workspaceId, formToInput(form));
      if (res?.error) {
        setError(res.error);
        return;
      }
      reset("Business record created.");
    });
  }

  function handleUpdate(id: string, form: FormState) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await updateBusiness(workspaceId, id, formToInput(form));
      if (res?.error) {
        setError(res.error);
        return;
      }
      reset("Business record updated.");
    });
  }

  function handleArchive(id: string, name: string) {
    if (!window.confirm(`Archive "${name}"? It will be hidden from the list.`)) {
      return;
    }
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await archiveBusiness(workspaceId, id);
      if (res?.error) {
        setError(res.error);
        return;
      }
      reset("Business record archived.");
    });
  }

  function handleRestore(id: string, name: string) {
    if (
      !window.confirm(
        `Restore "${name}"?\n\nThis restores the archived business as an active record. It does not undo changes made to any merge survivor.`
      )
    ) {
      return;
    }
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await restoreBusiness(workspaceId, id);
      if (res?.error) {
        setError(res.error);
        return;
      }
      reset("Business record restored.");
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          {notice}
        </p>
      ) : null}

      <BusinessToolbar />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total} {hasFilters ? "matching " : ""}
          {archived ? "archived " : ""}record{total === 1 ? "" : "s"}
          {hasFilters ? "" : archived ? "" : " in this workspace"}.
        </p>
        {!archived && openForm !== "new" ? (
          <Button
            type="button"
            onClick={() => {
              setOpenForm("new");
              setNotice(null);
              setError(null);
            }}
            disabled={pending}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add business
          </Button>
        ) : null}
      </div>

      {openForm === "new" ? (
        <BusinessForm
          title="New business"
          submitLabel="Create"
          pending={pending}
          onCancel={() => setOpenForm(null)}
          onSubmit={handleCreate}
        />
      ) : null}

      {businesses.length === 0 && openForm !== "new" ? (
        <Card className="p-8 text-center">
          {hasFilters ? (
            <p className="text-sm text-muted-foreground">
              No {archived ? "archived " : ""}records match the current search or
              filters.
            </p>
          ) : archived ? (
            <p className="text-sm text-muted-foreground">
              No archived records. Records you archive will appear here and can be
              restored.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No business records yet. Click{" "}
              <span className="text-foreground">Add business</span> to create the
              first one.
            </p>
          )}
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        {businesses.map((b) =>
          !archived && openForm === b.id ? (
            <BusinessForm
              key={b.id}
              title={`Edit — ${b.companyName}`}
              submitLabel="Save"
              initial={formFromBusiness(b)}
              pending={pending}
              onCancel={() => setOpenForm(null)}
              onSubmit={(form) => handleUpdate(b.id, form)}
            />
          ) : (
            <Card
              key={b.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {b.companyName}
                  </p>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-muted-foreground">
                    {b.status}
                  </span>
                  {b.businessType ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {b.businessType}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {[b.contactName, b.phone, b.email, [b.city, b.wilaya, b.country]
                    .filter(Boolean)
                    .join(", ")]
                    .filter(Boolean)
                    .join(" · ") || "No contact details"}
                </p>
                {b.supportedBrands.length > 0 ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    Brands: {b.supportedBrands.join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {archived ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => handleRestore(b.id, b.companyName)}
                  >
                    <ArchiveRestore className="mr-1 h-4 w-4" />
                    Restore
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        setOpenForm(b.id);
                        setNotice(null);
                        setError(null);
                      }}
                    >
                      <Pencil className="mr-1 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => handleArchive(b.id, b.companyName)}
                    >
                      <Archive className="mr-1 h-4 w-4" />
                      Archive
                    </Button>
                  </>
                )}
              </div>
            </Card>
          )
        )}
      </div>

      <BusinessPagination page={page} pageCount={pageCount} />
    </div>
  );
}

/** Create/edit form for a single business record. */
function BusinessForm({
  title,
  submitLabel,
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  title: string;
  submitLabel: string;
  initial?: FormState;
  pending: boolean;
  onSubmit: (form: FormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial ?? emptyForm());

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Company name" required value={form.companyName} maxLength={200} disabled={pending} onChange={(v) => set("companyName", v)} />
          <TextField label="Contact name" value={form.contactName} disabled={pending} onChange={(v) => set("contactName", v)} />
          <TextField label="Phone" value={form.phone} disabled={pending} onChange={(v) => set("phone", v)} />
          <TextField label="Email" type="email" value={form.email} disabled={pending} onChange={(v) => set("email", v)} />
          <TextField label="Website" value={form.website} disabled={pending} onChange={(v) => set("website", v)} />
          <TextField label="Business type" value={form.businessType} disabled={pending} onChange={(v) => set("businessType", v)} placeholder="supplier, garage, importer…" />
          <TextField label="City" value={form.city} disabled={pending} onChange={(v) => set("city", v)} />
          <TextField label="Wilaya" value={form.wilaya} disabled={pending} onChange={(v) => set("wilaya", v)} />
          <TextField label="Country" value={form.country} disabled={pending} onChange={(v) => set("country", v)} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bf-status">Status</Label>
            <select
              id="bf-status"
              value={form.status}
              disabled={pending}
              onChange={(e) => set("status", e.target.value as BusinessStatus)}
              className={`${FIELD_CLASS} h-9 capitalize`}
            >
              {BUSINESS_STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="bf-brands">Supported brands</Label>
            <Input
              id="bf-brands"
              value={form.brandsText}
              disabled={pending}
              onChange={(e) => set("brandsText", e.target.value)}
              placeholder="Comma-separated, e.g. Renault, Peugeot, Toyota"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="bf-address">Address</Label>
            <textarea
              id="bf-address"
              value={form.address}
              disabled={pending}
              onChange={(e) => set("address", e.target.value)}
              rows={2}
              className={FIELD_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="bf-notes">Notes</Label>
            <textarea
              id="bf-notes"
              value={form.notes}
              disabled={pending}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className={FIELD_CLASS}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending || form.companyName.trim() === ""}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
