import type { Metadata } from "next";
import { QuestionList } from "@/components/QuestionList";
import { Sidebar } from "@/components/Sidebar";
import { searchQuestions } from "@/lib/queries";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 200) : "";
  const questions = q ? await searchQuestions(q) : [];

  return (
    <div className="layout">
      <section>
        <div className="page-head">
          <div>
            <h1>Search</h1>
            <p>{q ? `Results for “${q}”` : "Search questions by keyword."}</p>
          </div>
        </div>
        <form action="/search/" className="card card-pad" role="search" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
          <label className="sr-only" htmlFor="q">
            Search
          </label>
          <input id="q" name="q" type="search" className="input" defaultValue={q} placeholder="e.g. onboarding checklist" />
          <button className="btn btn-primary" type="submit">
            Search
          </button>
        </form>
        {q && (
          <div className="card">
            <QuestionList questions={questions} empty={<p>No questions match your search. Try different words.</p>} />
          </div>
        )}
      </section>
      <Sidebar />
    </div>
  );
}
