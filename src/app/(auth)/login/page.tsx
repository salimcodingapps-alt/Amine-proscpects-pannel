import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { LoginIntro } from "@/components/auth/login-intro";

export const metadata: Metadata = { title: "Log in — Automotive BI CRM" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <LoginIntro>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Log in to your supplier intelligence workspace.
          </p>
        </div>
        <LoginForm next={next} />
      </div>
    </LoginIntro>
  );
}
