import Link from "next/link";
import {
  Archive,
  ArrowUpRight,
  Building2,
  CopyCheck,
  Database,
  MapPin,
  Tag,
  Upload,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/business/status-badge";
import {
  BUSINESS_STATUSES,
  type ValueCount,
  type WorkspaceDashboardStats,
} from "@/lib/businesses/types";

/**
 * Read-only CRM overview for the dashboard (Block 11). Pure presentation — it
 * renders the metrics computed server-side and links into the existing pages.
 * VIP TUNING identity comes from the shared theme tokens (gold primary on dark)
 * + the reused Card / StatusBadge components; no globals.css change.
 */

/** Quick links to the main destinations (plain Links — nav.ts is untouched). */
const QUICK_LINKS = [
  { label: "Database", href: "/database", icon: Database },
  { label: "Upload", href: "/upload", icon: Upload },
  { label: "Duplicates", href: "/duplicates", icon: CopyCheck },
  { label: "Archived", href: "/database?view=archived", icon: Archive },
] as const;

/** Headline figure card (e.g. Active businesses, Archived). */
function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Building2;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p
            className={`mt-1 text-3xl font-semibold tracking-tight ${
              accent ? "text-primary" : "text-foreground"
            }`}
          >
            {value.toLocaleString()}
          </p>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            accent
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

/** Reusable ranked list (top wilayas / top brands), with a friendly empty state. */
function RankedList({
  title,
  icon: Icon,
  items,
  emptyLabel,
}: {
  title: string;
  icon: typeof MapPin;
  items: ValueCount[];
  emptyLabel: string;
}) {
  const max = items.length > 0 ? items[0].count : 0;
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{item.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {item.count.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{
                      width: `${max > 0 ? Math.max(6, (item.count / max) * 100) : 0}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardOverview({
  stats,
}: {
  stats: WorkspaceDashboardStats;
}) {
  const {
    activeTotal,
    archivedTotal,
    statusCounts,
    topWilayas,
    topBrands,
    topCapped,
    recentlyUpdated,
  } = stats;

  return (
    <div className="space-y-6 p-6">
      {/* Headline counts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Active businesses"
          value={activeTotal}
          icon={Building2}
          accent
        />
        <StatCard label="Archived" value={archivedTotal} icon={Archive} />
      </div>

      {/* Status breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">By status</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {BUSINESS_STATUSES.map((status) => (
              <div key={status} className="flex flex-col gap-2">
                <span className="text-2xl font-semibold tabular-nums text-foreground">
                  {statusCounts[status].toLocaleString()}
                </span>
                <StatusBadge status={status} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top wilayas / brands */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankedList
          title="Top wilayas"
          icon={MapPin}
          items={topWilayas}
          emptyLabel="No wilaya data yet."
        />
        <RankedList
          title="Top brands"
          icon={Tag}
          items={topBrands}
          emptyLabel="No brand data yet."
        />
      </div>

      {topCapped ? (
        <p className="text-xs text-muted-foreground">
          Top wilayas &amp; brands are based on the first {stats.topScanned.toLocaleString()}{" "}
          active records — they may be incomplete for larger workspaces.
        </p>
      ) : null}

      {/* Recently updated */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium">Recently updated</CardTitle>
          <Link
            href="/database"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {recentlyUpdated.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No businesses yet. Add records on the Database page or import a CSV.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentlyUpdated.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/database?q=${encodeURIComponent(b.companyName)}`}
                    className="group flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                        {b.companyName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[b.wilaya, b.businessType].filter(Boolean).join(" · ") ||
                          "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={b.status} />
                      <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                        {b.updatedAt.slice(0, 10)}
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              <link.icon className="h-4 w-4" />
            </span>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
