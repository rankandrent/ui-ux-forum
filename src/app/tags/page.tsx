import type { Metadata } from "next";
import Link from "next/link";
import { plural } from "@/lib/format";
import { listTags } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Tags",
  description: "Browse UI/UX design questions by topic.",
  alternates: { canonical: "/tags/" },
};

export default async function TagsPage() {
  const tags = await listTags();
  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Tags</h1>
          <p>Topics people ask about most.</p>
        </div>
      </div>
      {tags.length === 0 ? (
        <div className="card empty">No tags yet — they appear when questions are asked.</div>
      ) : (
        <ul className="tags-grid" style={{ listStyle: "none", padding: 0 }}>
          {tags.map((t) => (
            <li key={t.slug} className="card card-pad" style={{ padding: 14 }}>
              <Link className="tag" href={`/t/${t.slug}/`}>
                {t.slug}
              </Link>
              <div className="hint" style={{ marginTop: 6 }}>
                {plural(t.question_count, "question")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
