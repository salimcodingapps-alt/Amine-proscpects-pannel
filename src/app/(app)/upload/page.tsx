import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";

export default function UploadPage() {
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Upload"
        description="Import supplier data from spreadsheets and images."
      />
      <Placeholder block="Block 6 — Spreadsheet Upload" />
    </div>
  );
}
