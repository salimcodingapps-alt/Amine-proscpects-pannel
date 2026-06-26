"use client";

import { useActionState } from "react";
import Link from "next/link";

import { signIn, type AuthState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert, SubmitButton } from "@/components/auth/auth-form";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<AuthState, FormData>(signIn, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormAlert error={state.error} />
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/reset-password"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <SubmitButton>Log in</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="text-primary hover:underline"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
