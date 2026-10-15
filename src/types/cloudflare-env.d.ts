// Bindings used by the app (see wrangler.jsonc). Minimal R2 typing — only what src/lib/images.ts uses.
interface ForumR2Object {
  body: ReadableStream;
  httpEtag: string;
  size: number;
  httpMetadata?: { contentType?: string };
}

interface ForumR2Bucket {
  get(key: string): Promise<ForumR2Object | null>;
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string }; customMetadata?: Record<string, string> },
  ): Promise<unknown>;
}

interface CloudflareEnv {
  FORUM_IMAGES?: ForumR2Bucket;
}
