import Link from "next/link";
import { Byline } from "@/components/Byline";
import { compactNumber } from "@/lib/format";
import { questionPath } from "@/lib/site";
import type { QuestionSummary } from "@/lib/types";

export function QuestionList({ questions, empty }: { questions: QuestionSummary[]; empty: React.ReactNode }) {
  if (questions.length === 0) return <div className="empty">{empty}</div>;
  return (
    <ul className="q-list">
      {questions.map((q) => (
        <li key={q.id} className="q-row">
          <div className="q-stats">
            <span>
              <strong>{q.score}</strong> {Math.abs(q.score) === 1 ? "vote" : "votes"}
            </span>
            <span className={q.answer_count > 0 ? `answered${q.accepted_answer_id ? " accepted" : ""}` : undefined}>
              <strong>{q.answer_count}</strong> {q.answer_count === 1 ? "answer" : "answers"}
            </span>
            <span>{compactNumber(q.view_count)} views</span>
          </div>
          <div>
            <h3 className="q-title">
              <Link href={questionPath(q.id, q.slug)}>{q.title}</Link>
            </h3>
            <div className="q-meta">
              {q.category && (
                <Link className="chip-cat" href={`/c/${q.category.slug}/`}>
                  {q.category.name}
                </Link>
              )}
              <ul className="tag-list">
                {q.tags.map((tag) => (
                  <li key={tag}>
                    <Link className="tag" href={`/t/${tag}/`}>
                      {tag}
                    </Link>
                  </li>
                ))}
              </ul>
              <Byline author={q.author} date={q.created_at} verb="asked" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
