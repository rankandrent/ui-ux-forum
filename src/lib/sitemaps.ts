import "server-only";
import { env } from "@/lib/env";
import { questionPath } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

// Sitemap index + per-type sitemaps. Only indexable URLs: visible threads (answered or not) whose
// author isn't banned; non-empty categories; tags with 3+ questions (same rule as the tag page's
// robots tag); profiles of members with at least one post who aren't banned.

const MAX_URLS = 50000;
type Entry = { loc: string; lastmod: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const iso = (d: string | Date) => new Date(d).toISOString();

export function xmlResponse(body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

export function urlset(entries: Entry[]) {
  const urls = entries
    .slice(0, MAX_URLS)
    .map((e) => `<url><loc>${esc(e.loc)}</loc><lastmod>${e.lastmod}</lastmod></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function sitemapIndex(entries: Entry[]) {
  const items = entries.map((e) => `<sitemap><loc>${esc(e.loc)}</loc><lastmod>${e.lastmod}</lastmod></sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

type ThreadRow = {
  id: number;
  slug: string;
  last_activity_at: string;
  category: { slug: string } | null;
  question_tags: { tags: { slug: string; question_count: number } | null }[];
  author: { is_banned: boolean; banned_until: string | null } | null;
};

const isBanned = (a: ThreadRow["author"]) => !!a?.is_banned && (!a.banned_until || new Date(a.banned_until) > new Date());

/** Indexable threads with their category and tags (newest activity first). */
export async function loadThreads(): Promise<ThreadRow[]> {
  const supabase = createPublicClient();
  const rows: ThreadRow[] = [];
  for (let from = 0; from < MAX_URLS; from += 1000) {
    const { data, error } = await supabase
      .from("questions")
      .select(
        "id, slug, last_activity_at, category:categories(slug), question_tags(tags(slug, question_count)), author:profiles!questions_author_id_fkey(is_banned, banned_until)",
      )
      .eq("is_deleted", false)
      .order("last_activity_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as unknown as ThreadRow[]).filter((t) => !isBanned(t.author)));
    if (data.length < 1000) break;
  }
  return rows;
}

export function threadEntries(threads: ThreadRow[]): Entry[] {
  return threads.map((t) => ({ loc: `${env.siteUrl}${questionPath(t.id, t.slug)}`, lastmod: iso(t.last_activity_at) }));
}

/** Latest activity per category / tag, taken from indexable threads. */
function latestBy(threads: ThreadRow[], keys: (t: ThreadRow) => string[]) {
  const map = new Map<string, string>();
  for (const t of threads) for (const k of keys(t)) if (!map.has(k) || map.get(k)! < t.last_activity_at) map.set(k, t.last_activity_at);
  return map;
}

export function categoryEntries(threads: ThreadRow[]): Entry[] {
  const latest = latestBy(threads, (t) => (t.category ? [t.category.slug] : []));
  return [...latest].map(([slug, at]) => ({ loc: `${env.siteUrl}/c/${slug}/`, lastmod: iso(at) }));
}

export function tagEntries(threads: ThreadRow[]): Entry[] {
  const latest = latestBy(threads, (t) =>
    t.question_tags.map((qt) => qt.tags).filter((tag) => tag && tag.question_count >= 3).map((tag) => tag!.slug),
  );
  return [...latest].map(([slug, at]) => ({ loc: `${env.siteUrl}/t/${slug}/`, lastmod: iso(at) }));
}

export async function userEntries(): Promise<Entry[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("indexable_profiles", { p_limit: MAX_URLS });
  if (error) throw error;
  return ((data ?? []) as { username: string; last_activity: string }[]).map((u) => ({
    loc: `${env.siteUrl}/u/${u.username}/`,
    lastmod: iso(u.last_activity),
  }));
}

export function newest(entries: Entry[], fallback = new Date(0)) {
  return entries.reduce((max, e) => (e.lastmod > max ? e.lastmod : max), iso(fallback));
}
