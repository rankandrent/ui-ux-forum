import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/** Origin of the current request (falls back to SITE_URL). Used for auth redirect URLs. */
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return env.siteUrl;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Only allow same-site relative redirects. */
export function safeNext(value: unknown, fallback = "/"): string {
  return typeof value === "string" && /^\/(?!\/)[^\s\\]*$/.test(value) ? value : fallback;
}
