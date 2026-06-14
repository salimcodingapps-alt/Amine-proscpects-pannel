import type { Metadata } from "next";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = {
  title: "Update password — Automotive BI CRM",
};

export default function UpdatePasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">
          Set a new password
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose a new password for your account.
        </p>
      </div>
      <UpdatePasswordForm />
    </div>
  );
}
