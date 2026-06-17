"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Merge } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { mergeBusinesses } from "@/lib/businesses/actions";
import {
  MERGEABLE_FIELDS,
  type Business,
  type BusinessInput,
  type MergeFieldSources,
} from "@/lib/businesses/types";
import type { DuplicateGroup } from "@/lib/businesses/duplicates";

/** Shared styling for native selects so they match the Input component. */
const FIELD_CLASS =
  "flex w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

/** Human-readable value of a field on a record ("" when empty). */
function fieldText(b: Business, key: keyof BusinessInput): string {
  if (key === "supportedBrands") return b.supportedBrands.join(", ");
  const v = (b as unknown as Record<string, unknown>)[key];
  return v == null ? "" : String(v);
}

/** Short label distinguishing each record in the group (A · Name (City, Wilaya)). */
function recordLabel(b: Business, idx: number): string {
  const tag = String.fromCharCode(65 + idx); // A, B, C, …
  const loc = [b.city, b.wilaya].filter(Boolean).join(", ");
  return `${tag} · ${b.companyName}${loc ? ` (${loc})` : ""}`;
}

/**
 * Block 8 — manual, write-careful duplicate merge for ONE detected group.
 *
 * The user picks the surviving record and, for each field where the records
 * differ, which record supplies the value. The client sends ONLY ids + field
 * sources (never field values) to `mergeBusinesses`, which re-fetches the records
 * and composes the survivor from trusted DB values. The survivor is updated; the
 * other records are soft-archived (recoverable). No hard delete, no bulk, no AI.
 */
export function MergeSheet({
  group,
  workspaceId,
}: {
  group: DuplicateGroup;
  workspaceId: string;
}) {
  const router = useRouter();
  const members = group.members;

  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Default survivor = oldest member (members are sorted createdAt asc upstream).
  const [survivorId, setSurvivorId] = useState(members[0].id);
  const [fieldSources, setFieldSources] = useState<MergeFieldSources>({});

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const survivor = byId.get(survivorId) ?? members[0];
  const loserIds = members.filter((m) => m.id !== survivorId).map((m) => m.id);

  // Only fields whose values differ across records need a choice.
  const conflictingFields = useMemo(
    () =>
      MERGEABLE_FIELDS.filter((f) => {
        const distinct = new Set(members.map((m) => fieldText(m, f.key)));
        return distinct.size > 1;
      }),
    [members]
  );

  const sourceForKey = (key: keyof BusinessInput): Business =>
    byId.get(fieldSources[key] ?? survivorId) ?? survivor;

  function onOpenChange(next: boolean) {
    if (next) {
      // Reset to a clean default state each time the sheet opens.
      setSurvivorId(members[0].id);
      setFieldSources({});
      setError(null);
    }
    setOpen(next);
  }

  function chooseSurvivor(id: string) {
    setSurvivorId(id);
    // Re-default every field to the new survivor's own values.
    setFieldSources({});
  }

  function setFieldSource(key: keyof BusinessInput, id: string) {
    setFieldSources((prev) => ({ ...prev, [key]: id }));
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await mergeBusinesses(workspaceId, {
        survivorId,
        loserIds,
        fieldSources,
      });
      if (!res.survivorUpdated) {
        setError(res.error ?? "The merge could not be completed.");
        return;
      }
      // Survivor merged. Re-run detection so the UI reflects reality.
      router.refresh();
      if (res.failedIds.length > 0) {
        // Partial: survivor merged but some duplicates remain active.
        setError(res.error ?? "Some duplicates could not be archived.");
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onOpenChange(true)}
      >
        <Merge className="mr-1 h-4 w-4" />
        Merge…
      </Button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-2xl"
        >
          <SheetHeader className="border-b border-border p-6">
            <SheetTitle>Merge duplicates</SheetTitle>
            <SheetDescription>
              Pick the record to keep and which values to carry over. The other
              records are archived (hidden but recoverable) — nothing is deleted.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-6 p-6">
            {error ? (
              <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </p>
            ) : null}

            {/* 1. Survivor selection */}
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                1. Record to keep
              </h3>
              <p className="text-xs text-muted-foreground">
                This record is updated with the chosen values; the others are
                archived.
              </p>
              <div className="flex flex-col gap-2">
                {members.map((m, idx) => (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${
                      m.id === survivorId
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="survivor"
                      className="mt-1"
                      checked={m.id === survivorId}
                      disabled={pending}
                      onChange={() => chooseSurvivor(m.id)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {recordLabel(m, idx)}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {[m.phone, m.email, m.website]
                          .filter(Boolean)
                          .join(" · ") || "No contact details"}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground/70">
                        Added {new Date(m.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* 2. Per-field source selection (only where records differ) */}
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                2. Choose values to keep
              </h3>
              {conflictingFields.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  The records have no conflicting values — the kept record&apos;s
                  values will be used as-is.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {conflictingFields.map((f) => (
                    <div key={f.key} className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-foreground">
                        {f.label}
                      </label>
                      <select
                        className={`${FIELD_CLASS} h-8`}
                        value={fieldSources[f.key] ?? survivorId}
                        disabled={pending}
                        onChange={(e) => setFieldSource(f.key, e.target.value)}
                      >
                        {members.map((m, idx) => {
                          const text = fieldText(m, f.key);
                          return (
                            <option key={m.id} value={m.id}>
                              {String.fromCharCode(65 + idx)} —{" "}
                              {text || "(empty)"}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. Final merged preview */}
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                3. Merged result preview
              </h3>
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {MERGEABLE_FIELDS.map((f) => {
                      const value = fieldText(sourceForKey(f.key), f.key);
                      return (
                        <tr key={f.key} className="border-b border-border last:border-0">
                          <th className="w-40 bg-secondary/40 px-3 py-2 font-medium text-muted-foreground">
                            {f.label}
                          </th>
                          <td className="px-3 py-2 text-foreground">
                            {value || <span className="text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Archive notice */}
            <section className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="flex items-start gap-2 text-sm text-amber-500">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {loserIds.length} record{loserIds.length === 1 ? "" : "s"} will
                  be archived (hidden from the list, recoverable):
                </span>
              </p>
              <ul className="ml-6 list-disc text-xs text-amber-500/90">
                {members
                  .filter((m) => m.id !== survivorId)
                  .map((m) => (
                    <li key={m.id} className="truncate">
                      {recordLabel(m, members.indexOf(m))}
                    </li>
                  ))}
              </ul>
            </section>
          </div>

          <div className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-surface p-6">
            <Button type="button" onClick={handleConfirm} disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Confirm merge — keep 1, archive ${loserIds.length}`
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
