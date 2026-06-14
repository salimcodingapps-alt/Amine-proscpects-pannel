"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Submit button that disables and shows a spinner while the action runs. */
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

/** Inline error / success message for auth forms. */
export function FormAlert({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) return null;
  return (
    <p
      role="status"
      className={
        error
          ? "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
      }
    >
      {error ?? success}
    </p>
  );
}
