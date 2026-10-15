import Link from "next/link";
import { modDelete, modResolveReport, modSetLock } from "@/app/actions/mod";
import { FlashError } from "@/components/FlashError";
import { timeAgo } from "@/lib/format";
import { excerpt } from "@/lib/markdown";
import { questionPath } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

type Report = {
  id: number;
  target_type: "question" | "answer" | "comment" | "user";
  target_id: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
  reporter: { username: string; display_name: string } | null;
};

type Target = { label: string; href: string | null; deleted: boolean; locked?: boolean; authorId: string | null };

const STATUSES = ["open", "resolved", "dismissed"] as const;

async function loadTargets(reports: Report[]) {
  const supabase = await createClient();
  const ids = (type: Report["target_type"]) =>
    [...new Set(reports.filter((r) => r.target_type === type).map((r) => r.target_id))];
  const num = (list: string[]) => list.map(Number).filter(Number.isSafeInteger);

  const [qs, as, cs, us] = await Promise.all([
    supabase.from("questions").select("id, slug, title, is_deleted, is_locked, author_id").in("id", num(ids("question"))),
    supabase
      .from("answers")
      .select("id, body, is_deleted, author_id, question:questions!answers_question_id_fkey(id, slug)")
      .in("id", num(ids("answer"))),
    supabase
      .from("comments")
      .select("id, body, is_deleted, author_id, question_id, answer:answers(question_id)")
      .in("id", num(ids("comment"))),
    supabase.from("profiles").select("id, username, display_name, is_banned").in("id", ids("user")),
  ]);

  const targets = new Map<string, Target>();
  for (const q of qs.data ?? [])
    targets.set(`question:${q.id}`, {
      label: q.title,
      href: questionPath(q.id, q.slug),
      deleted: q.is_deleted,
      locked: q.is_locked,
      authorId: q.author_id,
    });
  for (const a of (as.data ?? []) as unknown as {
    id: number;
    body: string;
    is_deleted: boolean;
    author_id: string | null;
    question: { id: number; slug: string } | null;
  }[])
    targets.set(`answer:${a.id}`, {
      label: excerpt(a.body, 140),
      href: a.question ? `${questionPath(a.question.id, a.question.slug)}#answer-${a.id}` : null,
      deleted: a.is_deleted,
      authorId: a.author_id,
    });
  for (const c of (cs.data ?? []) as unknown as {
    id: number;
    body: string;
    is_deleted: boolean;
    author_id: string | null;
    question_id: number | null;
    answer: { question_id: number } | null;
  }[]) {
    const qid = c.question_id ?? c.answer?.question_id;
    targets.set(`comment:${c.id}`, {
      label: excerpt(c.body, 140),
      href: qid ? `/q/${qid}/#comment-${c.id}` : null,
      deleted: c.is_deleted,
      authorId: c.author_id,
    });
  }
  for (const u of us.data ?? [])
    targets.set(`user:${u.id}`, {
      label: `${u.display_name} (@${u.username})${u.is_banned ? " — banned" : ""}`,
      href: `/u/${u.username}/`,
      deleted: false,
      authorId: u.id,
    });
  return targets;
}

export default async function ReportsPage({ searchParams }: PageProps<"/mod">) {
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status) ?? "open";
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select(
      "id, target_type, target_id, reason, details, status, created_at, reporter:profiles!reports_reporter_id_fkey(username, display_name)",
    )
    .eq("status", status)
    .order("created_at", { ascending: status !== "open" })
    .limit(100);
  const reports = (data ?? []) as unknown as Report[];
  const targets = await loadTargets(reports);
  const back = `/mod/?status=${status}`;

  return (
    <section className="card">
      <div className="card-pad" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <h2 style={{ margin: 0, marginRight: "auto" }}>Reports</h2>
        {STATUSES.map((s) => (
          <Link key={s} href={`/mod/?status=${s}`} className={s === status ? "btn btn-primary" : "btn btn-secondary"}>
            {s}
          </Link>
        ))}
      </div>
      <div className="card-pad" style={{ paddingTop: 0 }}>
        <FlashError value={sp.error} />
      </div>
      {reports.length === 0 ? (
        <p className="empty">No {status} reports.</p>
      ) : (
        <ul className="mod-list">
          {reports.map((r) => {
            const t = targets.get(`${r.target_type}:${r.target_id}`);
            const isPost = r.target_type !== "user";
            return (
              <li key={r.id} className="mod-item">
                <div className="mod-item-main">
                  <p style={{ margin: 0 }}>
                    <strong>{r.target_type}</strong> · {r.reason.replace("_", " ")} · {timeAgo(r.created_at)} by{" "}
                    {r.reporter ? <Link href={`/u/${r.reporter.username}/`}>{r.reporter.display_name}</Link> : "deleted user"}
                  </p>
                  {t ? (
                    <p style={{ margin: "4px 0" }}>
                      {t.href ? <Link href={t.href}>{t.label}</Link> : t.label}
                      {t.deleted && <em className="hint"> (deleted)</em>}
                      {t.locked && <em className="hint"> (locked)</em>}
                    </p>
                  ) : (
                    <p className="hint">Target no longer exists.</p>
                  )}
                  {r.details && <p className="hint" style={{ margin: 0 }}>“{r.details}”</p>}
                </div>
                <div className="mod-actions">
                  {status === "open" ? (
                    <>
                      <form action={modResolveReport}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="resolved" />
                        <input type="hidden" name="back" value={back} />
                        <button className="btn btn-secondary" type="submit">Resolve</button>
                      </form>
                      <form action={modResolveReport}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="dismissed" />
                        <input type="hidden" name="back" value={back} />
                        <button className="btn btn-ghost" type="submit">Dismiss</button>
                      </form>
                    </>
                  ) : (
                    <form action={modResolveReport}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="open" />
                      <input type="hidden" name="back" value={back} />
                      <button className="btn btn-ghost" type="submit">Reopen</button>
                    </form>
                  )}
                  {t && isPost && !t.deleted && (
                    <form action={modDelete}>
                      <input type="hidden" name="type" value={r.target_type} />
                      <input type="hidden" name="id" value={r.target_id} />
                      <input type="hidden" name="back" value={back} />
                      <button className="btn btn-ghost btn-danger" type="submit">Delete {r.target_type}</button>
                    </form>
                  )}
                  {t && r.target_type === "question" && !t.deleted && (
                    <form action={modSetLock}>
                      <input type="hidden" name="id" value={r.target_id} />
                      <input type="hidden" name="locked" value={t.locked ? "false" : "true"} />
                      <input type="hidden" name="back" value={back} />
                      <button className="btn btn-ghost" type="submit">{t.locked ? "Unlock" : "Lock"}</button>
                    </form>
                  )}
                  {t?.authorId && (
                    <Link className="btn btn-ghost" href={`/mod/users/?id=${t.authorId}`}>
                      {r.target_type === "user" ? "Manage user" : "Manage author"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
