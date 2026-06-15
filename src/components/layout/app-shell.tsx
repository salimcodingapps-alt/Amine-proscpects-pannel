import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import type { SessionUser } from "@/components/layout/user-menu";
import type { WorkspaceSummary } from "@/lib/workspace/types";

/**
 * Application shell: persistent sidebar (desktop) + mobile header,
 * with a scrollable main working area. Every authed page renders inside.
 */
export function AppShell({
  user,
  workspaces,
  activeWorkspaceId,
  children,
}: {
  user: SessionUser;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar
        user={user}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav
          user={user}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
