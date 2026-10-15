import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pagination, pageHref } from "@/components/Pagination";
import { QuestionList } from "@/components/QuestionList";
import { Sidebar } from "@/components/Sidebar";
import { SortTabs } from "@/components/SortTabs";
import { getCategories, listQuestions } from "@/lib/queries";
import { parsePage, parseSort } from "@/lib/site";

async function findCategory(slug: string) {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params, searchParams }: PageProps<"/c/[category]">): Promise<Metadata> {
  const category = await findCategory((await params).category);
  if (!category) return {};
  const sp = await searchParams;
  const filtered = sp.sort !== undefined || sp.page !== undefined;
  return {
    title: `${category.name} questions`,
    description: category.description,
    alternates: { canonical: `/c/${category.slug}/` },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/c/[category]">) {
  const category = await findCategory((await params).category);
  if (!category) notFound();
  const sp = await searchParams;
  const sort = parseSort(sp.sort);
  const page = parsePage(sp.page);
  const { questions, total } = await listQuestions({ sort, page, categoryId: category.id });
  const base = `/c/${category.slug}/`;

  return (
    <div className="layout">
      <section>
        <div className="page-head">
          <div>
            <h1>{category.name}</h1>
            <p>{category.description}</p>
          </div>
          <Link className="btn btn-primary" href="/ask/">
            Ask a question
          </Link>
        </div>
        <div className="card">
          <SortTabs basePath={base} current={sort} />
          <QuestionList questions={questions} empty={<p>No questions in this category yet.</p>} />
          <Pagination
            page={page}
            total={total}
            makeHref={(p) => pageHref(base, { sort: sort === "latest" ? undefined : sort, page: p > 1 ? String(p) : undefined })}
          />
        </div>
      </section>
      <Sidebar activeCategory={category.slug} />
    </div>
  );
}
