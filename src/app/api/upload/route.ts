import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { friendlyError } from "@/lib/errors";
import { getImageBucket, imageUrl, MAX_AVATAR_BYTES, MAX_IMAGE_BYTES, sniffImage } from "@/lib/images";
import { createClient, getViewer } from "@/lib/supabase/server";

// POST multipart/form-data { file, kind: "question" | "avatar" } → { url }
// Signed-in users only; the daily cap is enforced by record_upload() in the database.
export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  // Same-origin check (server actions get this from Next; this route needs its own).
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: "Bad request." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind") === "avatar" ? "avatar" : "question";
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });

  const limit = kind === "avatar" ? MAX_AVATAR_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    return NextResponse.json({ error: `Images must be under ${limit / 1024 / 1024} MB.` }, { status: 413 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return NextResponse.json({ error: "Use a PNG, JPG, WebP or GIF image." }, { status: 415 });

  const bucket = await getImageBucket();
  if (!bucket) return NextResponse.json({ error: "Image uploads are not available right now." }, { status: 503 });

  const now = new Date();
  const id = crypto.randomUUID();
  const key =
    kind === "avatar"
      ? `avatars/${viewer.id}/${id}.${type.ext}`
      : `q/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}.${type.ext}`;

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_upload", {
    p_key: key,
    p_content_type: type.contentType,
    p_size: bytes.byteLength,
  });
  if (error) return NextResponse.json({ error: friendlyError(error) }, { status: 400 });

  await bucket.put(key, bytes, {
    httpMetadata: { contentType: type.contentType, cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: { user: viewer.id },
  });
  const url = imageUrl(env.siteUrl, key);

  if (kind === "avatar") {
    const { error: profileError } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", viewer.id);
    if (profileError) return NextResponse.json({ error: friendlyError(profileError) }, { status: 400 });
  }
  return NextResponse.json({ url });
}
