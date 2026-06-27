"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { setContactStatus } from "@/lib/businesses/actions";
import { CONTACT_STATUSES, type ContactStatus } from "@/lib/businesses/types";

/** Compact native-select styling, matching the toolbar's filled controls. */
const SELECT_CLASS =
  "h-8 w-full max-w-[10.5rem] rounded-md border border-input bg-secondary/30 px-2 text-xs text-foreground shadow-sm transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Per-row contact-status quick editor (Block 15). A plain compact <select> that
 * writes the chosen outreach status via the setContactStatus server action and
 * refreshes so the list (and any active contact-status filter) stays in sync.
 * Self-contained useTransition so it doesn't interfere with BusinessManager's
 * create/edit/archive transition state. Shown only on ACTIVE rows.
 */
export function ContactStatusSelect({
  workspaceId,
  businessId,
  contactStatus,
}: {
  workspaceId: string;
  businessId: string;
  contactStatus: ContactStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(next: ContactStatus) {
    if (next === contactStatus) return;
    startTransition(async () => {
      const res = await setContactStatus(workspaceId, businessId, next);
      if (!res?.error) router.refresh();
    });
  }

  return (
    <select
      value={contactStatus}
      disabled={pending}
      onChange={(e) => onChange(e.target.value as ContactStatus)}
      className={SELECT_CLASS}
      aria-label="Contact status"
      title="Contact status"
    >
      {CONTACT_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
