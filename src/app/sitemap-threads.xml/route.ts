import { loadThreads, threadEntries, urlset, xmlResponse } from "@/lib/sitemaps";

export const dynamic = "force-dynamic";

export async function GET() {
  return xmlResponse(urlset(threadEntries(await loadThreads())));
}
