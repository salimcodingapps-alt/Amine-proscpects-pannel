"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { addToWatchlist, removeFromWatchlist } from "@/lib/businesses/watchlist";

/**
 * Per-row watchlist toggle (Block 14). Filled gold star = watchlisted; outline =
 * not. Calls the add/remove server action and refreshes so the shared list and
 * the `/watchlist` view stay in sync. Self-contained transition so it doesn't
 * interfere with BusinessManager's create/edit/archive transition state.
 */
export function WatchlistButton({
  workspaceId,
  businessId,
  watchlisted,
}: {
  workspaceId: string;
  businessId: string;
  watchlisted: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = watchlisted
        ? await removeFromWatchlist(workspaceId, businessId)
        : await addToWatchlist(workspaceId, businessId);
      if (!res?.error) router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`h-8 px-2.5 ${
        watchlisted
          ? "text-primary hover:text-primary"
          : "text-muted-foreground hover:text-primary"
      }`}
      disabled={pending}
      onClick={toggle}
      aria-label={watchlisted ? "Remove from watchlist" : "Add to watchlist"}
      aria-pressed={watchlisted}
      title={watchlisted ? "Remove from watchlist" : "Add to watchlist"}
    >
      <Star className={`h-4 w-4 ${watchlisted ? "fill-current" : ""}`} />
    </Button>
  );
}
