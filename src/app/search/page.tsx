import type { Metadata } from "next";
import { QuestionList } from "@/components/QuestionList";
import { Sidebar } from "@/components/Sidebar";
import { getCategories, searchQuestions } from "@/lib/queries";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 200) : "";
  const categories = await getCategories();
  const category = typeof sp.category === "string" && categories.some((c) => c.slug === sp.category) ? sp.category : "";
  const tag = typeof sp.tag === "string" && /^[a-z0-9][a-z0-9-]{0,29}$/.test(sp.tag) ? sp.tag : "";
  const questions = q ? await searchQuestions(q, { category, tag }) : [];

  return (
    <div className="layout">
      <section>
        <div className="page-head">
          <div>
            <h1>Search</h1>
            <p>{q ? `Results for “${q}”` : "Search questions by keyword."}</p>
          </div>
        </div>
        <form action="/search/" className="card card-pad search-form" role="search">
          <label className="sr-only" htmlFor="q">
            Search
          </label>
          <input id="q" name="q" type="search" className="input" defaultValue={q} placeholder="e.g. onboarding checklist" />
          <label className="sr-only" htmlFor="search-category">
            Category
          </label>
          <select id="search-category" name="category" className="select" defaultValue={category}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="search-tag">
            Tag
          </label>
          <input id="search-tag" name="tag" className="input" defaultValue={tag} placeholder="tag (optional)" />
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
