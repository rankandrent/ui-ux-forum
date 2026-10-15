import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { acceptAnswer, deletePost } from "@/app/actions/forum";
import { AnswerForm } from "@/components/AnswerForm";
import { Byline } from "@/components/Byline";
import { CommentForm } from "@/components/CommentForm";
import { Sidebar } from "@/components/Sidebar";
import { VoteButtons } from "@/components/VoteButtons";
import { compactNumber, plural, timeAgo } from "@/lib/format";
import { excerpt, renderMarkdown } from "@/lib/markdown";
import { getQuestion, getThread } from "@/lib/queries";
import { parseQuestionParam, questionPath } from "@/lib/site";
import { createClient, getViewer, type Viewer } from "@/lib/supabase/server";
import type { Comment } from "@/lib/types";

async function loadQuestion(param: string) {
  const id = parseQuestionParam(param);
  return id ? getQuestion(id) : null;
}

export async function generateMetadata({ params }: PageProps<"/q/[slug]">): Promise<Metadata> {
  const question = await loadQuestion((await params).slug);
  if (!question) return {};
  const path = questionPath(question.id, question.slug);
  const description = excerpt(question.body);
  // Thin pages (no answers yet) stay out of the index until they get one.
  const indexable = question.answer_count > 0 && !question.is_deleted;
  return {
    title: question.title,
    description,
    alternates: { canonical: path },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title: question.title, description, url: path, type: "article" },
  };
}

function CommentList({ comments, viewer, back }: { comments: Comment[]; viewer: Viewer | null; back: string }) {
  if (comments.length === 0) return null;
  const staff = viewer?.role === "admin" || viewer?.role === "moderator";
  return (
    <ul className="comments" style={{ listStyle: "none", padding: 0 }}>
      {comments.map((c) => (
        <li key={c.id} id={`comment-${c.id}`} className="comment">
          {c.is_deleted ? <em className="hint">[deleted] </em> : null}
          {c.body}{" "}
          <span className="comment-meta">
            –{" "}
            {c.author ? (
              <Link href={`/u/${c.author.username}/`}>{c.author.display_name}</Link>
            ) : (
              "deleted user"
            )}{" "}
            <time dateTime={c.created_at}>{timeAgo(c.created_at)}</time>
          </span>
          {!c.is_deleted && viewer && (staff || c.author_id === viewer.id) && (
            <form action={deletePost} style={{ display: "inline" }}>
              <input type="hidden" name="type" value="comment" />
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="back" value={back} />
              <button className="btn btn-ghost btn-danger" type="submit">
                delete
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function QuestionPage({ params, searchParams }: PageProps<"/q/[slug]">) {
  const param = (await params).slug;
  const question = await loadQuestion(param);
  if (!question) notFound();
  const path = questionPath(question.id, question.slug);
  if (param !== `${question.id}-${question.slug}`) permanentRedirect(path);

  const viewer = await getViewer();
  const { answers, comments, votes } = await getThread(question.id, viewer?.id ?? null);
  const supabase = await createClient();
  await supabase.rpc("record_question_view", { p_id: question.id });

  const sp = await searchParams;
  const flashError = typeof sp.error === "string" ? sp.error.slice(0, 200) : null;
  const staff = viewer?.role === "admin" || viewer?.role === "moderator";
  const isAsker = !!viewer && viewer.id === question.author_id;
  const canWrite = !!viewer && !question.is_locked && !question.is_deleted;
  const visibleAnswers = answers.filter((a) => !a.is_deleted || staff || a.author_id === viewer?.id);
  const liveAnswerCount = answers.filter((a) => !a.is_deleted).length;

  return (
    <div className="layout">
      <article className="card">
        <header className="thread-head">
          <h1>{question.title}</h1>
          <div className="q-meta">
            <span>
              Asked <time dateTime={question.created_at}>{timeAgo(question.created_at)}</time>
            </span>
            <span>Viewed {compactNumber(question.view_count + 1)} times</span>
            {question.category && (
              <Link className="chip-cat" href={`/c/${question.category.slug}/`}>
                {question.category.name}
              </Link>
            )}
            {question.is_locked && <strong>🔒 Locked</strong>}
            {question.is_deleted && <strong className="btn-danger">Deleted</strong>}
          </div>
        </header>

        {flashError && (
          <p className="alert alert-error" role="alert" style={{ margin: "16px 24px 0" }}>
            {flashError}
          </p>
        )}

        <div className="post">
          <VoteButtons
            type="question"
            id={question.id}
            score={question.score}
            myVote={votes.get(`question:${question.id}`) ?? 0}
            canVote={!!viewer}
          />
          <div>
            <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(question.body) }} />
            <ul className="tag-list" style={{ marginTop: 16 }}>
              {question.tags.map((tag) => (
                <li key={tag}>
                  <Link className="tag" href={`/t/${tag}/`}>
                    {tag}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="post-footer">
              <div className="post-actions">
                {viewer && (isAsker || staff) && (!question.is_locked || staff) && (
                  <Link className="btn btn-ghost" href={`${path}edit/`}>
                    Edit
                  </Link>
                )}
                {viewer && ((isAsker && liveAnswerCount === 0) || staff) && !question.is_deleted && (
                  <form action={deletePost}>
                    <input type="hidden" name="type" value="question" />
                    <input type="hidden" name="id" value={question.id} />
                    <input type="hidden" name="back" value={path} />
                    <button className="btn btn-ghost btn-danger" type="submit">
                      Delete
                    </button>
                  </form>
                )}
              </div>
              <Byline author={question.author} date={question.created_at} verb="asked" />
            </div>
            <CommentList comments={comments.filter((c) => c.question_id === question.id)} viewer={viewer} back={path} />
            {canWrite && <CommentForm questionId={question.id} />}
          </div>
        </div>

        <div className="answers-head" id="answers">
          <h2>{plural(liveAnswerCount, "Answer")}</h2>
        </div>

        {visibleAnswers.map((answer) => (
          <div key={answer.id} id={`answer-${answer.id}`} className={`post${answer.is_accepted ? " accepted" : ""}`}>
            <VoteButtons
              type="answer"
              id={answer.id}
              score={answer.score}
              myVote={votes.get(`answer:${answer.id}`) ?? 0}
              canVote={!!viewer}
            />
            <div>
              {answer.is_accepted && (
                <p className="accepted-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z" fill="currentColor" />
                  </svg>
                  Accepted answer
                </p>
              )}
              {answer.is_deleted && <p className="hint">This answer was deleted.</p>}
              <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(answer.body) }} />
              <div className="post-footer">
                <div className="post-actions">
                  {isAsker && !question.is_locked && !answer.is_deleted && (
                    <form action={acceptAnswer}>
                      <input type="hidden" name="answer_id" value={answer.id} />
                      <button className="btn btn-ghost" type="submit" style={{ color: "var(--success)" }}>
                        {answer.is_accepted ? "Unaccept" : "Accept this answer"}
                      </button>
                    </form>
                  )}
                  {viewer && (answer.author_id === viewer.id || staff) && !answer.is_deleted && (
                    <>
                      {(!question.is_locked || staff) && (
                        <Link className="btn btn-ghost" href={`/a/${answer.id}/edit/`}>
                          Edit
                        </Link>
                      )}
                      <form action={deletePost}>
                        <input type="hidden" name="type" value="answer" />
                        <input type="hidden" name="id" value={answer.id} />
                        <input type="hidden" name="back" value={path} />
                        <button className="btn btn-ghost btn-danger" type="submit">
                          Delete
                        </button>
                      </form>
                    </>
                  )}
                </div>
                <Byline author={answer.author} date={answer.created_at} verb="answered" />
              </div>
              <CommentList comments={comments.filter((c) => c.answer_id === answer.id)} viewer={viewer} back={path} />
              {canWrite && !answer.is_deleted && <CommentForm questionId={question.id} answerId={answer.id} />}
            </div>
          </div>
        ))}

        <div className="post" style={{ display: "block", borderTop: "1px solid var(--border)" }}>
          {question.is_locked ? (
            <p className="hint">This question is locked. New answers and comments are disabled.</p>
          ) : viewer ? (
            <AnswerForm questionId={question.id} />
          ) : (
            <p>
              <Link className="btn btn-primary" href={`/login/?next=${encodeURIComponent(path)}`}>
                Log in to answer
              </Link>
            </p>
          )}
        </div>
      </article>
      <Sidebar activeCategory={question.category?.slug} />
    </div>
  );
}
