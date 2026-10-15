import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 1024 * 1024;

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

export async function getImageBucket() {
  const { env } = await getCloudflareContext({ async: true });
  return env.FORUM_IMAGES ?? null;
}

/** Object keys look like `q/2026/10/<uuid>.png` or `avatars/<user-id>/<uuid>.webp`. */
export const IMAGE_KEY_RE = /^(q|avatars)\/[a-z0-9/_-]+\.(png|jpg|webp|gif)$/;

export function imageUrl(siteUrl: string, key: string) {
  return `${siteUrl}/img/${key}`;
}
