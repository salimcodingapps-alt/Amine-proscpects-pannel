import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";

export default function SettingsPage() {
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Settings"
        description="Workspace, team, and account configuration."
      />
      <Placeholder block="Blocks 2–3 — Authentication & Workspaces" />
    </div>
  );
}
