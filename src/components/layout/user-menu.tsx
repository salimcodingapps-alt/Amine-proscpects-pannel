"use client";

import { LogOut } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export interface SessionUser {
  email: string;
  name: string | null;
}

/** Signed-in identity + logout, shown in the sidebar and mobile drawer. */
export function UserMenu({ user }: { user: SessionUser }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium uppercase text-foreground">
        {(user.name ?? user.email).charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        {user.name ? (
          <p className="truncate text-sm font-medium text-foreground">
            {user.name}
          </p>
        ) : null}
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <form action={signOut}>
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
