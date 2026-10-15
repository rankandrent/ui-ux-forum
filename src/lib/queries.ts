import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, type SortKey } from "@/lib/site";
import type { Answer, Category, Comment, Question, QuestionSummary } from "@/lib/types";

// Explicit FK hints: questions/answers also reach profiles through the vote tables.
const author = (table: "questions" | "answers" | "comments") =>
  `author:profiles!${table}_author_id_fkey(username, display_name, avatar_url, reputation)`;
const SUMMARY_FIELDS = `id, title, slug, score, answer_count, view_count, accepted_answer_id, created_at, last_activity_at,
  ${author("questions")}, category:categories(slug, name), question_tags(tags(slug))`;

type TagJoin = { question_tags?: { tags: { slug: string } | null }[] };

function withTags<T extends TagJoin>(row: T) {
  const { question_tags, ...rest } = row;
  return { ...rest, tags: (question_tags ?? []).map((qt) => qt.tags?.slug).filter(Boolean).sort() as string[] };
}

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, description")
    .order("sort_order");
  if (error) throw error;
  return data;
});

export async function listQuestions(opts: {
  sort: SortKey;
  page: number;
  categoryId?: number;
  tagId?: number;
  authorId?: string;
}): Promise<{ questions: QuestionSummary[]; total: number }> {
  const supabase = await createClient();
  const select = opts.tagId ? `${SUMMARY_FIELDS}, tag_filter:question_tags!inner(tag_id)` : SUMMARY_FIELDS;
  let query = supabase.from("questions").select(select, { count: "exact" }).eq("is_deleted", false);

  if (opts.categoryId) query = query.eq("category_id", opts.categoryId);
  if (opts.tagId) query = query.eq("tag_filter.tag_id", opts.tagId);
  if (opts.authorId) query = query.eq("author_id", opts.authorId);

  if (opts.sort === "top") {
    query = query.order("score", { ascending: false }).order("created_at", { ascending: false });
  } else if (opts.sort === "unanswered") {
    query = query.eq("answer_count", 0).order("created_at", { ascending: false });
  } else {
    query = query.order("last_activity_at", { ascending: false });
  }

  const from = (opts.page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  // Page past the end: PostgREST answers 416 — treat it as an empty page (callers 404 it).
  if (error?.code === "PGRST103") return { questions: [], total: count ?? 0 };
  if (error) throw error;
  const rows = (data ?? []) as unknown as (QuestionSummary & TagJoin & { tag_filter?: unknown })[];
  return {
    questions: rows.map((row) => {
      const { tag_filter: _ignored, ...rest } = row;
      void _ignored;
      return withTags(rest) as QuestionSummary;
    }),
    total: count ?? 0,
  };
}

export const getQuestion = cache(async (id: number): Promise<Question | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select(`${SUMMARY_FIELDS}, body, image_url, author_id, is_locked, is_deleted, updated_at, comment_count`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? (withTags(data as unknown as Question & TagJoin) as Question) : null;
});

export async function getThread(questionId: number, viewerId: string | null) {
  const supabase = await createClient();
  const answersRes = await supabase
    .from("answers")
    .select(`id, question_id, author_id, body, score, is_accepted, is_deleted, created_at, updated_at, ${author("answers")}`)
    .eq("question_id", questionId)
    .order("is_accepted", { ascending: false })
    .order("score", { ascending: false })
    .order("created_at", { ascending: true });
  if (answersRes.error) throw answersRes.error;
  const answers = (answersRes.data ?? []) as unknown as Answer[];
  const answerIds = answers.map((a) => a.id);

  const commentQuery = supabase
    .from("comments")
    .select(`id, question_id, answer_id, author_id, body, is_deleted, created_at, ${author("comments")}`)
    .order("created_at", { ascending: true })
    .limit(500);
  const { data: comments, error: commentsError } = await (answerIds.length
    ? commentQuery.or(`question_id.eq.${questionId},answer_id.in.(${answerIds.join(",")})`)
    : commentQuery.eq("question_id", questionId));
  if (commentsError) throw commentsError;

  const votes = new Map<string, number>();
  if (viewerId) {
    const [qv, av] = await Promise.all([
      supabase.from("question_votes").select("question_id, value").eq("user_id", viewerId).eq("question_id", questionId),
      answerIds.length
        ? supabase.from("answer_votes").select("answer_id, value").eq("user_id", viewerId).in("answer_id", answerIds)
        : Promise.resolve({ data: [] as { answer_id: number; value: number }[] }),
    ]);
    for (const v of qv.data ?? []) votes.set(`question:${v.question_id}`, v.value);
    for (const v of av.data ?? []) votes.set(`answer:${v.answer_id}`, v.value);
  }

  return { answers, comments: (comments ?? []) as unknown as Comment[], votes };
}

export async function getTagBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("id, slug, question_count").eq("slug", slug).maybeSingle();
  return data;
}

export async function listTags(limit = 200) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tags")
    .select("slug, question_count")
    .gt("question_count", 0)
    .order("question_count", { ascending: false })
    .order("slug")
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function searchQuestions(
  q: string,
  filters: { category?: string; tag?: string } = {},
  limit = 30,
): Promise<QuestionSummary[]> {
  const supabase = await createClient();
  const { data: hits, error } = await supabase.rpc("search_questions", {
    p_query: q,
    p_category_slug: filters.category || null,
    p_tag: filters.tag || null,
    p_limit: limit,
    p_offset: 0,
  });
  if (error) throw error;
  const ids = ((hits ?? []) as { id: number }[]).map((h) => h.id);
  if (ids.length === 0) return [];

  const { data, error: rowsError } = await supabase.from("questions").select(SUMMARY_FIELDS).in("id", ids);
  if (rowsError) throw rowsError;
  const byId = new Map(
    ((data ?? []) as unknown as (QuestionSummary & TagJoin)[]).map((row) => [row.id, withTags(row) as QuestionSummary]),
  );
  // Keep the rank order from search_questions().
  return ids.map((id) => byId.get(id)).filter((q): q is QuestionSummary => !!q);
}

export async function getUnreadNotificationCount(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

export type NotificationRow = {
  id: number;
  type: "answer" | "comment" | "accepted" | "badge" | "moderation";
  question_id: number | null;
  answer_id: number | null;
  comment_id: number | null;
  message: string | null;
  read_at: string | null;
  created_at: string;
  actor: { username: string; display_name: string; avatar_url: string | null } | null;
  question: { title: string; slug: string } | null;
};

export async function listNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      `id, type, question_id, answer_id, comment_id, message, read_at, created_at,
       actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url),
       question:questions(title, slug)`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as NotificationRow[];
}

/** Aggregated up/down votes for a thread (question + answers), keyed "question:<id>" / "answer:<id>". */
export async function getVoteTallies(questionId: number) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("thread_vote_tallies", { p_question_id: questionId });
  const map = new Map<string, { ups: number; downs: number }>();
  for (const row of (data ?? []) as { target_type: string; target_id: number; ups: number; downs: number }[]) {
    map.set(`${row.target_type}:${row.target_id}`, { ups: row.ups, downs: row.downs });
  }
  return map;
}
