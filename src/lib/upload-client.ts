// Browser helpers: shrink images before upload, then POST them to /api/upload/.

const MAX_BYTES = 1024 * 1024;
const MAX_SIDE = { question: 1600, avatar: 512 } as const;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file is not an image we can read."));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Resizes to the kind's max side and re-encodes as WebP (JPEG fallback) under 1 MB. GIFs pass through. */
export async function compressImage(file: File, kind: "question" | "avatar"): Promise<File> {
  if (file.type === "image/gif") {
    if (file.size > MAX_BYTES) throw new Error("GIFs must be under 1 MB.");
    return file;
  }
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE[kind] / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const type of ["image/webp", "image/jpeg"]) {
    for (const quality of [0.85, 0.75, 0.6, 0.45]) {
      const blob = await toBlob(canvas, type, quality);
      if (!blob || blob.type !== type) break; // browser can't encode this type
      if (blob.size <= MAX_BYTES) {
        return new File([blob], `image.${type === "image/webp" ? "webp" : "jpg"}`, { type });
      }
    }
  }
  throw new Error("This image is too large. Please use a smaller one.");
}

/** Uploads an image and returns its public URL. */
export async function uploadImage(file: File, kind: "question" | "avatar"): Promise<string> {
  const body = new FormData();
  body.set("file", await compressImage(file, kind));
  body.set("kind", kind);
  const res = await fetch("/api/upload/", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed. Please try again.");
  return data.url;
}
