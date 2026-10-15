"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrigin, safeNext } from "@/lib/request";
import { verifyChallenge } from "@/lib/turnstile";
import type { ActionResult } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readEmail(formData: FormData) {
  return String(formData.get("email") ?? "").trim().toLowerCase();
}

async function callbackUrl(next: string) {
  return `${await getOrigin()}/auth/callback/?next=${encodeURIComponent(next)}`;
}

export async function signInWithPassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  if (!EMAIL_RE.test(email) || !password) return { ok: false, error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") return { ok: false, error: "Please confirm your email first — check your inbox." };
    return { ok: false, error: "Incorrect email or password." };
  }
  redirect(next);
}

export async function sendMagicLink(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = readEmail(formData);
  const next = safeNext(formData.get("next"));
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: await callbackUrl(next), shouldCreateUser: true },
  });
  if (error) {
    if (error.status === 429) return { ok: false, error: "Too many emails sent. Please wait a few minutes." };
    return { ok: false, error: "Could not send the sign-in link. Please try again." };
  }
  return { ok: true, message: `We sent a sign-in link to ${email}. Open it on this device.` };
}

export async function signUp(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (password.length < 8) return { ok: false, error: "Use at least 8 characters for your password." };
  const challengeError = await verifyChallenge(formData, null);
  if (challengeError) return { ok: false, error: challengeError };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: await callbackUrl("/"), data: name ? { full_name: name } : undefined },
  });
  if (error) {
    if (error.code === "weak_password") return { ok: false, error: "That password is too weak. Try a longer one." };
    if (error.status === 429) return { ok: false, error: "Too many attempts. Please wait a few minutes." };
    return { ok: false, error: "Could not create your account. Please try again." };
  }
  if (data.session) redirect("/");
  return { ok: true, message: `Almost done — confirm your email using the link we sent to ${email}.` };
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl(next) },
  });
  if (error || !data.url) redirect("/login/?error=google");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
