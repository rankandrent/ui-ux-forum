import { NextResponse, type NextRequest } from "next/server";
import { friendlyError } from "@/lib/errors";
import { imageKey, MAX_IMAGE_BYTES, sniffImage, storeImage } from "@/lib/images";
import { createClient, getViewer } from "@/lib/supabase/server";

// POST multipart/form-data { file, kind: "question" | "avatar" } → { url }
// Signed-in users only; the daily cap is enforced by record_upload() in the database and
// own-folder / not-banned by the storage policy.
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
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Images must be under 1 MB." }, { status: 413 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return NextResponse.json({ error: "Use a PNG, JPG, WebP or GIF image." }, { status: 415 });

  const key = imageKey(kind, viewer.id, type.ext);
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_upload", {
    p_key: key,
    p_content_type: type.contentType,
    p_size: bytes.byteLength,
  });
  if (error) return NextResponse.json({ error: friendlyError(error) }, { status: 400 });

  let url: string;
  try {
    url = await storeImage(supabase, key, bytes, type.contentType);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  if (kind === "avatar") {
    const { error: profileError } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", viewer.id);
    if (profileError) return NextResponse.json({ error: friendlyError(profileError) }, { status: 400 });
  }
  return NextResponse.json({ url });
}
