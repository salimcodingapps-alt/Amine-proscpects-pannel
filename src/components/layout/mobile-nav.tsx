"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { BrandMark } from "@/components/layout/brand-mark";
import { NavLinks } from "@/components/layout/nav-links";
import { UserMenu, type SessionUser } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Mobile header with a hamburger that opens the navigation drawer.
 * Visible only below the `md` breakpoint; the drawer reuses NavLinks
 * and closes itself on navigation.
 */
export function MobileNav({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-16 items-center gap-3 border-b border-border bg-surface px-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center border-b border-border px-4">
            <BrandMark />
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t border-border p-3">
            <UserMenu user={user} />
          </div>
        </SheetContent>
      </Sheet>
      <BrandMark />
    </header>
  );
}
