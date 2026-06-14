"use client";

import { useActionState } from "react";

import { updatePassword, type AuthState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert, SubmitButton } from "@/components/auth/auth-form";

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    updatePassword,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormAlert error={state.error} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <SubmitButton>Update password</SubmitButton>
    </form>
  );
}
