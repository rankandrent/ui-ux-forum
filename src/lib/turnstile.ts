import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import type { Viewer } from "@/lib/supabase/server";

/** Turnstile runs only when both keys are configured. */
export function turnstileEnabled() {
  return Boolean(env.turnstileSiteKey && env.turnstileSecretKey);
}

/** Established members (50+ reputation) and staff skip the challenge when posting. */
export function needsChallenge(viewer: Viewer | null) {
  if (!turnstileEnabled()) return false;
  if (!viewer) return true;
  return viewer.role === "user" && viewer.reputation < 50;
}

/** Site key to render the widget with, or "" when the viewer doesn't need one. */
export function challengeSiteKey(viewer: Viewer | null) {
  return needsChallenge(viewer) ? env.turnstileSiteKey : "";
}

/** Returns an error message, or null when the token is valid (or no challenge is needed). */
export async function verifyChallenge(formData: FormData, viewer: Viewer | null): Promise<string | null> {
  if (!needsChallenge(viewer)) return null;
  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!token) return "Please complete the security check.";

  const h = await headers();
  const body = new URLSearchParams({ secret: env.turnstileSecretKey, response: token });
  const ip = h.get("cf-connecting-ip");
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const data = (await res.json()) as { success?: boolean };
    return data.success ? null : "The security check failed. Please try again.";
  } catch {
    return "Could not verify the security check. Please try again.";
  }
}
