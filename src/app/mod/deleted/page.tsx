import Link from "next/link";
import { modRestore } from "@/app/actions/mod";
import { FlashError } from "@/components/FlashError";
import { timeAgo } from "@/lib/format";
import { excerpt } from "@/lib/markdown";
import { questionPath } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

type Row = { type: "question" | "answer" | "comment"; id: number; label: string; href: string | null; at: string; author: string };

export default async function DeletedPage({ searchParams }: PageProps<"/mod/deleted">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const author = (t: string) => `author:profiles!${t}_author_id_fkey(username)`;
  const [qs, as, cs] = await Promise.all([
    supabase.from("questions").select(`id, slug, title, updated_at, ${author("questions")}`).eq("is_deleted", true)
      .order("updated_at", { ascending: false }).limit(50),
    supabase.from("answers").select(`id, body, updated_at, question:questions!answers_question_id_fkey(id, slug), ${author("answers")}`).eq("is_deleted", true)
      .order("updated_at", { ascending: false }).limit(50),
    supabase.from("comments").select(`id, body, created_at, question_id, answer:answers(question_id), ${author("comments")}`)
      .eq("is_deleted", true).order("created_at", { ascending: false }).limit(50),
  ]);

  type A = { username: string } | null;
  const rows: Row[] = [
    ...((qs.data ?? []) as unknown as { id: number; slug: string; title: string; updated_at: string; author: A }[]).map((q) => ({
      type: "question" as const, id: q.id, label: q.title, href: questionPath(q.id, q.slug), at: q.updated_at,
      author: q.author?.username ?? "deleted user",
    })),
    ...((as.data ?? []) as unknown as { id: number; body: string; updated_at: string; question: { id: number; slug: string } | null; author: A }[]).map((a) => ({
      type: "answer" as const, id: a.id, label: excerpt(a.body, 140),
      href: a.question ? `${questionPath(a.question.id, a.question.slug)}#answer-${a.id}` : null, at: a.updated_at,
      author: a.author?.username ?? "deleted user",
    })),
    ...((cs.data ?? []) as unknown as { id: number; body: string; created_at: string; question_id: number | null; answer: { question_id: number } | null; author: A }[]).map((c) => {
      const qid = c.question_id ?? c.answer?.question_id;
      return {
        type: "comment" as const, id: c.id, label: excerpt(c.body, 140), href: qid ? `/q/${qid}/#comment-${c.id}` : null,
        at: c.created_at, author: c.author?.username ?? "deleted user",
      };
    }),
  ].sort((x, y) => y.at.localeCompare(x.at));

  return (
    <section className="card">
      <div className="card-pad">
        <h2 style={{ margin: 0 }}>Deleted posts</h2>
        <p className="hint" style={{ margin: "4px 0 0" }}>The 50 most recent of each type. Restoring puts the post back where it was.</p>
        <FlashError value={sp.error} />
      </div>
      {rows.length === 0 ? (
        <p className="empty">Nothing has been deleted.</p>
      ) : (
        <ul className="mod-list">
          {rows.map((r) => (
            <li key={`${r.type}:${r.id}`} className="mod-item">
              <div className="mod-item-main">
                <p style={{ margin: 0 }}>
                  <strong>{r.type}</strong> by @{r.author} · {timeAgo(r.at)}
                </p>
                <p style={{ margin: "4px 0 0" }}>{r.href ? <Link href={r.href}>{r.label}</Link> : r.label}</p>
              </div>
              <div className="mod-actions">
                <form action={modRestore}>
                  <input type="hidden" name="type" value={r.type} />
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="back" value="/mod/deleted/" />
                  <button className="btn btn-secondary" type="submit">Restore</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
