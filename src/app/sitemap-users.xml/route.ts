import { urlset, userEntries, xmlResponse } from "@/lib/sitemaps";

export const dynamic = "force-dynamic";

export async function GET() {
  return xmlResponse(urlset(await userEntries()));
}
