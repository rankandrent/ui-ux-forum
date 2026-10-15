import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { env } from "@/lib/env";

/** Supabase client acting as the signed-in user (RLS applies). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — the session is refreshed in middleware.
        }
      },
    },
  });
}

export type Viewer = {
  id: string;
  email: string | undefined;
  username: string;
  display_name: string;
  avatar_url: string | null;
  reputation: number;
  role: "user" | "moderator" | "admin";
  is_banned: boolean;
};

/** The signed-in user with their profile, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, reputation, role, is_banned")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;
  return { id: userId, email: claims.claims.email as string | undefined, ...profile } as Viewer;
});
