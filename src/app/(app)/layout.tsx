import { AppShell } from "@/components/layout/app-shell";

/**
 * Layout for the authenticated application area.
 * NOTE: no auth gate yet — that arrives in Block 2. For now this simply
 * wraps every app page in the sidebar + mobile shell.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
