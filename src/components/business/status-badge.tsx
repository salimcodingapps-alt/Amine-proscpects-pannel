import type { BusinessStatus } from "@/lib/businesses/types";

/**
 * Color-coded pill for the four existing business statuses. Pure presentation —
 * no new status types, no data. Classes are per-call-site (existing theme tokens
 * + Tailwind's default palette) so this needs no globals.css change.
 */
const STATUS_CLASS: Record<BusinessStatus, string> = {
  new: "text-primary bg-primary/10 ring-primary/20",
  contacted: "text-sky-300 bg-sky-500/10 ring-sky-500/20",
  qualified: "text-success bg-success/10 ring-success/20",
  inactive: "text-muted-foreground bg-muted ring-border",
};

const DOT_CLASS: Record<BusinessStatus, string> = {
  new: "bg-primary",
  contacted: "bg-sky-300",
  qualified: "bg-success",
  inactive: "bg-muted-foreground",
};

export function StatusBadge({ status }: { status: BusinessStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_CLASS[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[status]}`} />
      {status}
    </span>
  );
}
