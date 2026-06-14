"use client";

import { useActionState } from "react";
import Link from "next/link";

import { requestPasswordReset, type AuthState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert, SubmitButton } from "@/components/auth/auth-form";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormAlert error={state.error} success={state.success} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>
      <SubmitButton>Send reset link</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
