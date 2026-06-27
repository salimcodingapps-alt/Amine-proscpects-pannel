"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  FileUp,
  Building2,
  SearchX,
  Star,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { BusinessToolbar } from "@/components/business/business-toolbar";
import { BusinessPagination } from "@/components/business/business-pagination";
import { StatusBadge } from "@/components/business/status-badge";
import { BrandChips } from "@/components/business/brand-logo-chip";
import { WatchlistButton } from "@/components/business/watchlist-button";
import { ContactStatusSelect } from "@/components/business/contact-status-select";
import {
  archiveBusiness,
  createBusiness,
  restoreBusiness,
  updateBusiness,
} from "@/lib/businesses/actions";
import {
  BUSINESS_STATUSES,
  CONTACT_STATUSES,
  DEFAULT_CONTACT_STATUS,
  type Business,
  type BusinessInput,
  type BusinessStatus,
  type ContactStatus,
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
  contactStatus: ContactStatus;
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
    contactStatus: DEFAULT_CONTACT_STATUS,
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
    contactStatus: b.contactStatus,
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
  idPrefix = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  type?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  idPrefix?: string;
}) {
  const id = `${idPrefix}bf-${label.toLowerCase().replace(/\s+/g, "-")}`;
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
    contactStatus: form.contactStatus,
    supportedBrands: form.brandsText
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== ""),
    address: form.address,
    notes: form.notes,
  };
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Compact, deterministic "Updated" label (e.g. "18 Jun 2026"). Uses UTC parts so
 * the server-rendered and client-rendered strings always match (no hydration
 * mismatch and no locale variance). Presentation only.
 */
function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** One-line contact summary shown under the company name. */
function contactSummary(b: Business): string {
  const place = [b.city, b.wilaya, b.country].filter(Boolean).join(", ");
  return (
    [b.contactName, b.phone, b.email, place].filter(Boolean).join(" · ") ||
    "No contact details"
  );
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
  watchlist = false,
  watchlistedIds = [],
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
  /** Block 14: watchlist page mode (hides Add/Import; watchlist-aware copy). */
  watchlist?: boolean;
  /** Block 14: ids on the shared watchlist, for the per-row star state. */
  watchlistedIds?: string[];
}) {
  const watchlistedSet = new Set(watchlistedIds);
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

  /** Per-row action buttons — identical in the desktop table and mobile cards. */
  function rowActions(b: Business) {
    if (archived) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-muted-foreground hover:text-primary"
          disabled={pending}
          onClick={() => handleRestore(b.id, b.companyName)}
        >
          <ArchiveRestore className="mr-1 h-4 w-4" />
          Restore
        </Button>
      );
    }
    return (
      <>
        <WatchlistButton
          workspaceId={workspaceId}
          businessId={b.id}
          watchlisted={watchlistedSet.has(b.id)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-muted-foreground hover:text-foreground"
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
          className="h-8 px-2.5 text-muted-foreground hover:text-destructive"
          disabled={pending}
          onClick={() => handleArchive(b.id, b.companyName)}
        >
          <Archive className="mr-1 h-4 w-4" />
          Archive
        </Button>
      </>
    );
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{total}</span>{" "}
          {hasFilters ? "matching " : ""}
          {archived ? "archived " : watchlist ? "watchlisted " : ""}record
          {total === 1 ? "" : "s"}
          {hasFilters ? "" : archived || watchlist ? "" : " in this workspace"}.
        </p>
        {!archived && !watchlist ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/upload">
                <FileUp className="mr-1 h-4 w-4" />
                Import CSV
              </Link>
            </Button>
            {openForm !== "new" ? (
              <Button
                type="button"
                className="shadow-sm"
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
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          {hasFilters ? (
            <>
              <SearchX className="h-8 w-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  No matches
                </p>
                <p className="text-sm text-muted-foreground">
                  No {archived ? "archived " : ""}records match the current search
                  or filters. Try adjusting or clearing them.
                </p>
              </div>
            </>
          ) : archived ? (
            <>
              <ArchiveRestore className="h-8 w-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  No archived records
                </p>
                <p className="text-sm text-muted-foreground">
                  Records you archive will appear here and can be restored.
                </p>
              </div>
            </>
          ) : watchlist ? (
            <>
              <Star className="h-8 w-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  No watchlisted businesses yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Star records in{" "}
                  <Link href="/database" className="text-foreground hover:text-primary">
                    Database
                  </Link>{" "}
                  to add them to the shared watchlist.
                </p>
              </div>
            </>
          ) : (
            <>
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  No business records yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Click <span className="text-foreground">Add business</span> to
                  create the first one, or{" "}
                  <span className="text-foreground">Import CSV</span> to bring in
                  existing data.
                </p>
              </div>
            </>
          )}
        </Card>
      ) : null}

      {businesses.length > 0 ? (
        <>
          {/* Desktop: table layout */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card/40 shadow-sm md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Business</th>
                  <th className="px-4 py-3 font-semibold">Brands</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Wilaya</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {!archived ? (
                    <th className="px-4 py-3 font-semibold">Contact</th>
                  ) : null}
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((b) =>
                  !archived && openForm === b.id ? (
                    <tr key={b.id} className="border-b border-border last:border-0">
                      {/* Active view always has 8 columns (Contact column shown). */}
                      <td colSpan={8} className="p-3">
                        <BusinessForm
                          idPrefix={`d-${b.id}-`}
                          title={`Edit — ${b.companyName}`}
                          submitLabel="Save"
                          initial={formFromBusiness(b)}
                          pending={pending}
                          onCancel={() => setOpenForm(null)}
                          onSubmit={(form) => handleUpdate(b.id, form)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={b.id}
                      className="group border-b border-border align-top transition-colors last:border-0 hover:bg-secondary/30 hover:shadow-[inset_2px_0_0_0_var(--primary)]"
                    >
                      <td className="max-w-xs px-5 py-3.5 align-top">
                        <p className="truncate font-medium text-foreground">
                          {b.companyName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {contactSummary(b)}
                        </p>
                      </td>
                      <td className="max-w-[14rem] px-4 py-3.5 align-top text-muted-foreground">
                        <BrandChips brands={b.supportedBrands} max={3} nowrap />
                      </td>
                      <td className="px-4 py-3.5 align-top text-muted-foreground">
                        {b.businessType || "—"}
                      </td>
                      <td className="px-4 py-3.5 align-top text-muted-foreground">
                        {b.wilaya || "—"}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <StatusBadge status={b.status} />
                      </td>
                      {!archived ? (
                        <td className="px-4 py-3.5 align-top">
                          <ContactStatusSelect
                            workspaceId={workspaceId}
                            businessId={b.id}
                            contactStatus={b.contactStatus}
                          />
                        </td>
                      ) : null}
                      <td className="whitespace-nowrap px-4 py-3.5 align-top text-xs text-muted-foreground">
                        {formatUpdated(b.updatedAt)}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <div className="flex items-center justify-end gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                          {rowActions(b)}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: card layout */}
          <div className="flex flex-col gap-3 md:hidden">
            {businesses.map((b) =>
              !archived && openForm === b.id ? (
                <BusinessForm
                  key={b.id}
                  idPrefix={`m-${b.id}-`}
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
                  className="flex flex-col gap-3 rounded-xl p-4 transition-colors hover:bg-secondary/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {b.companyName}
                      </p>
                      {b.businessType ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {b.businessType}
                          {b.wilaya ? ` · ${b.wilaya}` : ""}
                        </p>
                      ) : b.wilaya ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {b.wilaya}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {contactSummary(b)}
                  </p>
                  {b.supportedBrands.length > 0 ? (
                    <BrandChips brands={b.supportedBrands} max={6} />
                  ) : null}
                  {!archived ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Contact
                      </span>
                      <ContactStatusSelect
                        workspaceId={workspaceId}
                        businessId={b.id}
                        contactStatus={b.contactStatus}
                      />
                    </div>
                  ) : null}
                  <div className="flex items-center justify-end gap-1 border-t border-border pt-3">
                    {rowActions(b)}
                  </div>
                </Card>
              )
            )}
          </div>
        </>
      ) : null}

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
  idPrefix = "",
}: {
  title: string;
  submitLabel: string;
  initial?: FormState;
  pending: boolean;
  onSubmit: (form: FormState) => void;
  onCancel: () => void;
  /** Prefix for control ids so duplicated (desktop+mobile) edit forms stay unique. */
  idPrefix?: string;
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
          <TextField idPrefix={idPrefix} label="Company name" required value={form.companyName} maxLength={200} disabled={pending} onChange={(v) => set("companyName", v)} />
          <TextField idPrefix={idPrefix} label="Contact name" value={form.contactName} disabled={pending} onChange={(v) => set("contactName", v)} />
          <TextField idPrefix={idPrefix} label="Phone" value={form.phone} disabled={pending} onChange={(v) => set("phone", v)} />
          <TextField idPrefix={idPrefix} label="Email" type="email" value={form.email} disabled={pending} onChange={(v) => set("email", v)} />
          <TextField idPrefix={idPrefix} label="Website" value={form.website} disabled={pending} onChange={(v) => set("website", v)} />
          <TextField idPrefix={idPrefix} label="Business type" value={form.businessType} disabled={pending} onChange={(v) => set("businessType", v)} placeholder="supplier, garage, importer…" />
          <TextField idPrefix={idPrefix} label="City" value={form.city} disabled={pending} onChange={(v) => set("city", v)} />
          <TextField idPrefix={idPrefix} label="Wilaya" value={form.wilaya} disabled={pending} onChange={(v) => set("wilaya", v)} />
          <TextField idPrefix={idPrefix} label="Country" value={form.country} disabled={pending} onChange={(v) => set("country", v)} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}bf-status`}>Status</Label>
            <select
              id={`${idPrefix}bf-status`}
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}bf-contact-status`}>Contact status</Label>
            <select
              id={`${idPrefix}bf-contact-status`}
              value={form.contactStatus}
              disabled={pending}
              onChange={(e) =>
                set("contactStatus", e.target.value as ContactStatus)
              }
              className={`${FIELD_CLASS} h-9`}
            >
              {CONTACT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={`${idPrefix}bf-brands`}>Supported brands</Label>
            <Input
              id={`${idPrefix}bf-brands`}
              value={form.brandsText}
              disabled={pending}
              onChange={(e) => set("brandsText", e.target.value)}
              placeholder="Comma-separated, e.g. Renault, Peugeot, Toyota"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={`${idPrefix}bf-address`}>Address</Label>
            <textarea
              id={`${idPrefix}bf-address`}
              value={form.address}
              disabled={pending}
              onChange={(e) => set("address", e.target.value)}
              rows={2}
              className={FIELD_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={`${idPrefix}bf-notes`}>Notes</Label>
            <textarea
              id={`${idPrefix}bf-notes`}
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
