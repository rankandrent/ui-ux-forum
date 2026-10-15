import { env } from "@/lib/env";
import { categoryEntries, loadThreads, newest, sitemapIndex, tagEntries, threadEntries, userEntries, xmlResponse } from "@/lib/sitemaps";

export const dynamic = "force-dynamic";

export async function GET() {
  const threads = await loadThreads();
  const parts = [
    { name: "threads", entries: threadEntries(threads) },
    { name: "categories", entries: categoryEntries(threads) },
    { name: "tags", entries: tagEntries(threads) },
    { name: "users", entries: await userEntries() },
  ];
  return xmlResponse(
    sitemapIndex(
      parts.map((p) => ({
        loc: `${env.siteUrl}/sitemap-${p.name}.xml`,
        lastmod: p.entries.length ? newest(p.entries) : new Date().toISOString(),
      })),
    ),
  );
}
