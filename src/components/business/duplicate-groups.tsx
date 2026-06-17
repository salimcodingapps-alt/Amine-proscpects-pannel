import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { MergeSheet } from "@/components/business/merge-sheet";
import {
  SIGNAL_LABELS,
  type DuplicateGroup,
  type DuplicateReport,
} from "@/lib/businesses/duplicates";

/**
 * Read-only presentation of detected duplicate groups (Block 7). Shows WHY each
 * group was flagged (reason badges) and lets the user inspect each record in
 * the database list. There are deliberately NO actions here — no merge, no
 * delete, no dismiss — this block only detects and explains.
 */
export function DuplicateGroups({
  report,
  workspaceId,
}: {
  report: DuplicateReport;
  workspaceId: string;
}) {
  const { groups, scannedCount, capped } = report;
  const recordsInvolved = groups.reduce((sum, g) => sum + g.members.length, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      {capped ? (
        <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This workspace has a large number of records, so duplicate detection
            scanned only the first {scannedCount} and may be incomplete.
            Full-scale detection is planned for a future optimization.
          </span>
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Scanned {scannedCount} active record{scannedCount === 1 ? "" : "s"}.{" "}
        {groups.length > 0 ? (
          <>
            Found{" "}
            <span className="text-foreground">
              {groups.length} likely-duplicate group{groups.length === 1 ? "" : "s"}
            </span>{" "}
            covering {recordsInvolved} record{recordsInvolved === 1 ? "" : "s"}.
          </>
        ) : (
          "No likely duplicates detected."
        )}
      </p>

      {groups.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <CheckCircle2 className="h-6 w-6 text-success" />
          <p className="text-sm text-muted-foreground">
            No likely duplicates were found in this workspace using phone, email,
            website, or company-name&nbsp;+&nbsp;locality matching.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <DuplicateGroupCard
              key={group.id}
              group={group}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** One duplicate group: the reasons it was flagged + its member records. */
function DuplicateGroupCard({
  group,
  workspaceId,
}: {
  group: DuplicateGroup;
  workspaceId: string;
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {group.members.length} possible duplicates
          </span>
          {group.matches.map((m) => (
            <span
              key={`${m.signal}:${m.value}`}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary"
              title={m.value}
            >
              {SIGNAL_LABELS[m.signal]}
              <span className="max-w-[16rem] truncate text-primary/70">· {m.value}</span>
            </span>
          ))}
        </div>
        <MergeSheet group={group} workspaceId={workspaceId} />
      </div>

      <div className="flex flex-col divide-y divide-border">
        {group.members.map((b) => (
          <div
            key={b.id}
            className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {b.companyName}
                </p>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-muted-foreground">
                  {b.status}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {[
                  b.contactName,
                  b.phone,
                  b.email,
                  b.website,
                  [b.city, b.wilaya, b.country].filter(Boolean).join(", "),
                ]
                  .filter(Boolean)
                  .join(" · ") || "No contact details"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">
                Added {new Date(b.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Link
              href={`/database?q=${encodeURIComponent(b.companyName)}`}
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              Inspect in database →
            </Link>
          </div>
        ))}
      </div>
    </Card>
  );
}
