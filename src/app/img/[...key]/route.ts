import { getImageBucket, IMAGE_KEY_RE } from "@/lib/images";

// Serves uploaded images from R2. Keys are random UUIDs, so responses are cached forever.
export async function GET(_request: Request, ctx: RouteContext<"/img/[...key]">) {
  const key = (await ctx.params).key.join("/");
  if (!IMAGE_KEY_RE.test(key)) return new Response("Not found", { status: 404 });

  const bucket = await getImageBucket();
  const object = bucket ? await bucket.get(key) : null;
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: object.httpEtag,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
