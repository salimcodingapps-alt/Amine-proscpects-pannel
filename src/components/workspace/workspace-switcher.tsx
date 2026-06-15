"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createWorkspace, switchWorkspace } from "@/lib/workspace/actions";
import type { WorkspaceSummary } from "@/lib/workspace/types";

/**
 * Workspace picker shown at the top of the sidebar and mobile drawer.
 * Lists the user's workspaces, switches the active one, and creates new ones
 * (via the create_workspace RPC). Built from primitives — no dropdown library.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: {
  workspaces: WorkspaceSummary[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active =
    workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null;

  function close() {
    setOpen(false);
    setCreating(false);
    setError(null);
  }

  function handleSwitch(id: string) {
    if (id === active?.id) {
      close();
      return;
    }
    startTransition(async () => {
      const res = await switchWorkspace(id);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a workspace name.");
      return;
    }
    startTransition(async () => {
      const res = await createWorkspace(trimmed);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setName("");
      close();
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <span className="truncate text-left">
          {active ? active.name : "No workspace"}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>

      {open ? (
        <>
          {/* Click-away backdrop */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={close}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-border bg-surface p-1 shadow-lg"
          >
            <div className="max-h-64 overflow-y-auto">
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSwitch(w.id)}
                  disabled={pending}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      w.id === active?.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {w.name}
                  </span>
                  <span className="shrink-0 text-xs capitalize text-muted-foreground">
                    {w.role}
                  </span>
                </button>
              ))}
            </div>

            <div className="my-1 h-px bg-border" />

            {creating ? (
              <form onSubmit={handleCreate} className="p-1">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Workspace name"
                  maxLength={100}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="mt-1.5 flex gap-1.5">
                  <Button type="submit" size="sm" disabled={pending}>
                    {pending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Create"
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCreating(false);
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setCreating(true);
                  setError(null);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-4 w-4 shrink-0" />
                New workspace
              </button>
            )}

            {error ? (
              <p className="px-2 py-1 text-xs text-destructive">{error}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
