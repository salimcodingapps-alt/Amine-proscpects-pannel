import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import type { SessionUser } from "@/components/layout/user-menu";

/**
 * Application shell: persistent sidebar (desktop) + mobile header,
 * with a scrollable main working area. Every authed page renders inside.
 */
export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav user={user} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
