import { BrandMark } from "@/components/layout/brand-mark";
import { NavLinks } from "@/components/layout/nav-links";

/** Persistent desktop sidebar. Hidden below the `md` breakpoint. */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center border-b border-border px-4">
        <BrandMark />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavLinks />
      </div>
      <div className="border-t border-border p-4 text-xs text-muted-foreground">
        MVP V1
      </div>
    </aside>
  );
}
