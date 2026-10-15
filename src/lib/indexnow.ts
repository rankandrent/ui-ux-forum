import "server-only";
import { env } from "@/lib/env";

// IndexNow (Bing, Yandex, Seznam…): free freshness pings. The key is public by design and is
// served from /public/549db8021e939953fd51dd95e66c59af.txt. Google ignores IndexNow; it relies on sitemap lastmod.
const KEY = "549db8021e939953fd51dd95e66c59af";

export async function pingIndexNow(paths: string[]) {
  if (!paths.length || !env.siteUrl.startsWith("https://")) return;
  const host = new URL(env.siteUrl).host;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: KEY,
        keyLocation: `${env.siteUrl}/${KEY}.txt`,
        urlList: paths.map((p) => `${env.siteUrl}${p}`),
      }),
    });
    if (!res.ok && res.status !== 202) console.error("indexnow", res.status);
  } catch {
    // best effort
  }
}
