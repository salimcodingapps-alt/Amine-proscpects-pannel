import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";

export default function DatabasePage() {
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Database"
        description="Search, filter, and manage your supplier records."
      />
      <Placeholder block="Block 5 — Manual Business Table" />
    </div>
  );
}
