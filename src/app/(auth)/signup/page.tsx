import type { Metadata } from "next";

import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Sign up — Automotive BI CRM" };

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Start building your automotive supplier database.
        </p>
      </div>
      <SignupForm />
    </div>
  );
}
