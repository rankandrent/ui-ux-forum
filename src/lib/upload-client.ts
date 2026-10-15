/** Browser helper: uploads an image to /api/upload/ and returns its URL. */
export async function uploadImage(file: File, kind: "question" | "avatar"): Promise<string> {
  const body = new FormData();
  body.set("file", file);
  body.set("kind", kind);
  const res = await fetch("/api/upload/", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed. Please try again.");
  return data.url;
}
