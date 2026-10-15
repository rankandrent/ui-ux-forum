import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Image storage. Everything storage-specific lives in this module so the backend can change
// (Supabase Storage today — free tier, no payment method — Cloudflare R2 possible later).

export const IMAGE_BUCKET = "forum-images";
/** Same as the bucket's file_size_limit (0006_storage.sql). Browsers resize before uploading. */
export const MAX_IMAGE_BYTES = 1024 * 1024;

const TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
} as const;
export type ImageExt = keyof typeof TYPES;

/** Detects the image type from its first bytes (never trusts the file name or browser type). */
export function sniffImage(bytes: Uint8Array): { ext: ImageExt; contentType: string } | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  let ext: ImageExt | null = null;
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ext = "png";
  else if (starts([0xff, 0xd8, 0xff])) ext = "jpg";
  else if (starts([0x47, 0x49, 0x46, 0x38])) ext = "gif";
  else if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) ext = "webp";
  return ext ? { ext, contentType: TYPES[ext] } : null;
}

/** Object keys: `q/<user-id>/<uuid>.<ext>` or `avatars/<user-id>/<uuid>.<ext>` (storage policy checks the user id). */
export function imageKey(kind: "question" | "avatar", userId: string, ext: ImageExt) {
  return `${kind === "avatar" ? "avatars" : "q"}/${userId}/${crypto.randomUUID()}.${ext}`;
}

/**
 * Stores an image as the signed-in user (storage RLS applies) and returns its public URL.
 * Throws with a user-facing message on failure.
 */
export async function storeImage(
  supabase: SupabaseClient,
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(key, bytes, { contentType, cacheControl: "31536000", upsert: false });
  if (error) {
    console.error("storage upload failed", error.message);
    throw new Error("Could not save the image. Please try again.");
  }
  return `${env.supabaseUrl}/storage/v1/object/public/${IMAGE_BUCKET}/${key}`;
}
