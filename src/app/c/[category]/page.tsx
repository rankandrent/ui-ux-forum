import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Pagination, pageHref } from "@/components/Pagination";
import { QuestionList } from "@/components/QuestionList";
import { Sidebar } from "@/components/Sidebar";
import { SortTabs } from "@/components/SortTabs";
import { getCategories, listQuestions } from "@/lib/queries";
import { env } from "@/lib/env";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/schema";
import { parsePage, parseSort } from "@/lib/site";
import { INDEX_ROBOTS, NOINDEX_ROBOTS, OG_IMAGES } from "@/lib/seo";

async function findCategory(slug: string) {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params, searchParams }: PageProps<"/c/[category]">): Promise<Metadata> {
  const category = await findCategory((await params).category);
  if (!category) return {};
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const sorted = sp.sort !== undefined;
  const base = `/c/${category.slug}/`;
  const { total } = await listQuestions({ sort: "latest", page: 1, categoryId: category.id });
  const title = page > 1 ? `${category.name} questions — page ${page}` : `${category.name} questions`;
  return {
    title,
    description: category.description,
    // Page N is self-canonical; sort variants and empty categories stay out of the index.
    alternates: { canonical: page > 1 && !sorted ? `${base}?page=${page}` : base },
    robots: sorted || total === 0 ? NOINDEX_ROBOTS : INDEX_ROBOTS,
    openGraph: { title, description: category.description, url: base, images: OG_IMAGES },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/c/[category]">) {
  const category = await findCategory((await params).category);
  if (!category) notFound();
  const sp = await searchParams;
  const sort = parseSort(sp.sort);
  const page = parsePage(sp.page);
  const { questions, total } = await listQuestions({ sort, page, categoryId: category.id });
  if (page > 1 && questions.length === 0) notFound();
  const base = `/c/${category.slug}/`;

  return (
    <div className="layout">
      <JsonLd data={breadcrumbJsonLd(env.siteUrl, [{ name: category.name, path: base }])} />
      {questions.length > 0 && (
        <JsonLd
          data={collectionJsonLd(env.siteUrl, {
            name: `${category.name} questions`,
            description: category.description,
            path: base,
            questions,
          })}
        />
      )}
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
