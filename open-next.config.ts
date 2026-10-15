import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Forum pages are rendered per request (they depend on the signed-in user),
// so no incremental cache is configured — this keeps everything on the free tier.
export default defineCloudflareConfig({});
