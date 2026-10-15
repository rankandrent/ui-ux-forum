import { loadThreads, tagEntries, urlset, xmlResponse } from "@/lib/sitemaps";

export const dynamic = "force-dynamic";

export async function GET() {
  return xmlResponse(urlset(tagEntries(await loadThreads())));
}
