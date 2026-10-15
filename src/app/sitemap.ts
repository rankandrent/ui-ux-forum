import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { questionPath } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

// Rendered per request (data changes constantly); CDN-cached for an hour via the header in next.config.ts.
export const dynamic = "force-dynamic";

const MAX_URLS = 45000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = env.siteUrl;
  const supabase = createPublicClient();

  // Only threads with at least one answer — unanswered threads are noindex.
  const questions: { id: number; slug: string; last_activity_at: string }[] = [];
  for (let from = 0; from < MAX_URLS; from += 1000) {
    const { data, error } = await supabase
      .from("questions")
      .select("id, slug, last_activity_at")
      .eq("is_deleted", false)
      .gt("answer_count", 0)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    questions.push(...data);
    if (data.length < 1000) break;
  }

  const [{ data: categories }, { data: tags }] = await Promise.all([
    supabase.from("categories").select("slug").order("sort_order"),
    supabase.from("tags").select("slug").gte("question_count", 3).order("question_count", { ascending: false }).limit(1000),
  ]);

  return [
    { url: `${site}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${site}/tags/`, changeFrequency: "daily", priority: 0.5 },
    ...(categories ?? []).map((c) => ({ url: `${site}/c/${c.slug}/`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...(tags ?? []).map((t) => ({ url: `${site}/t/${t.slug}/`, changeFrequency: "weekly" as const, priority: 0.4 })),
    ...questions.map((q) => ({
      url: `${site}${questionPath(q.id, q.slug)}`,
      lastModified: q.last_activity_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
