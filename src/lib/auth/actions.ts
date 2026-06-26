"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; success?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Post-auth redirect target. Only INTERNAL, non-protocol-relative paths are
 * allowed (open-redirect guard): must start with a single "/", never "//" or
 * "/\". Anything else falls back to /dashboard. Used to return an invited user
 * to /invite/<token> after they sign in or sign up.
 */
function safeNext(formData: FormData): string {
  const next = str(formData, "next");
  if (
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }
  return "/dashboard";
}

async function getOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = str(formData, "email");
  const password = str(formData, "password");

  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (!password) return { error: "Enter your password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect(safeNext(formData));
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const fullName = str(formData, "fullName");
  const email = str(formData, "email");
  const password = str(formData, "password");

  if (!fullName) return { error: "Enter your name." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < MIN_PASSWORD)
    return { error: `Password must be at least ${MIN_PASSWORD} characters.` };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { error: error.message };

  // Email confirmation is disabled in dev, so a session is established
  // immediately and the user can proceed straight to the app.
  redirect(safeNext(formData));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = str(formData, "email");
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });
  if (error) return { error: error.message };

  return {
    success:
      "If an account exists for that email, a password reset link has been sent.",
  };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = str(formData, "password");
  const confirm = str(formData, "confirmPassword");

  if (password.length < MIN_PASSWORD)
    return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
  if (password !== confirm) return { error: "Passwords do not match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}
