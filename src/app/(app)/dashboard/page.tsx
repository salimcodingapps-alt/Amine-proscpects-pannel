import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

/**
 * Dashboard shell. Stat cards are intentionally static placeholders —
 * real figures arrive once the database, uploads, and duplicate systems
 * exist (Blocks 4–9). This block only proves layout and styling.
 */
const stats = [
  { label: "Total Businesses", value: "—" },
  { label: "Customers", value: "—" },
  { label: "Not Contacted", value: "—" },
  { label: "Duplicates", value: "—" },
  { label: "Needs Review", value: "—" },
  { label: "Recent Uploads", value: "—" },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Dashboard"
        description="Overview of your automotive supplier database."
      />
      <div className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-semibold tracking-tight text-foreground">
                  {stat.value}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Placeholder metrics — populated once data import is implemented.
        </p>
      </div>
    </div>
  );
}
