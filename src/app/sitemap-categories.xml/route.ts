import { env } from "@/lib/env";
import { categoryEntries, loadThreads, newest, urlset, xmlResponse } from "@/lib/sitemaps";

export const dynamic = "force-dynamic";

export async function GET() {
  const threads = await loadThreads();
  const categories = categoryEntries(threads);
  const home = { loc: `${env.siteUrl}/`, lastmod: categories.length ? newest(categories) : new Date().toISOString() };
  const tagsIndex = { loc: `${env.siteUrl}/tags/`, lastmod: home.lastmod };
  return xmlResponse(urlset([home, tagsIndex, ...categories]));
}
