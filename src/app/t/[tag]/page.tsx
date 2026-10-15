import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Pagination, pageHref } from "@/components/Pagination";
import { QuestionList } from "@/components/QuestionList";
import { Sidebar } from "@/components/Sidebar";
import { SortTabs } from "@/components/SortTabs";
import { plural } from "@/lib/format";
import { getTagBySlug, listQuestions } from "@/lib/queries";
import { env } from "@/lib/env";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/schema";
import { parsePage, parseSort } from "@/lib/site";
import { INDEX_ROBOTS, NOINDEX_ROBOTS, OG_IMAGES } from "@/lib/seo";

export async function generateMetadata({ params, searchParams }: PageProps<"/t/[tag]">): Promise<Metadata> {
  const tag = await getTagBySlug((await params).tag);
  if (!tag) return {};
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const sorted = sp.sort !== undefined;
  const base = `/t/${tag.slug}/`;
  // Thin tags (< 3 questions) and sort variants stay out of the index; page N is self-canonical.
  const thin = tag.question_count < 3 || sorted;
  const title = page > 1 ? `Questions tagged ${tag.slug} — page ${page}` : `Questions tagged ${tag.slug}`;
  const description = `${tag.question_count} UI/UX design questions and answers about ${tag.slug}.`;
  return {
    title,
    description,
    alternates: { canonical: page > 1 && !sorted ? `${base}?page=${page}` : base },
    robots: thin ? NOINDEX_ROBOTS : INDEX_ROBOTS,
    openGraph: { title, description, url: base, images: OG_IMAGES },
  };
}

export default async function TagPage({ params, searchParams }: PageProps<"/t/[tag]">) {
  const tag = await getTagBySlug((await params).tag);
  if (!tag) notFound();
  const sp = await searchParams;
  const sort = parseSort(sp.sort);
  const page = parsePage(sp.page);
  const { questions, total } = await listQuestions({ sort, page, tagId: tag.id });
  if (page > 1 && questions.length === 0) notFound();
  const base = `/t/${tag.slug}/`;

  return (
    <div className="layout">
      <JsonLd data={breadcrumbJsonLd(env.siteUrl, [{ name: "Tags", path: "/tags/" }, { name: tag.slug, path: base }])} />
      {questions.length > 0 && (
        <JsonLd
          data={collectionJsonLd(env.siteUrl, {
            name: `Questions tagged ${tag.slug}`,
            description: `UI/UX design questions about ${tag.slug}.`,
            path: base,
            questions,
          })}
        />
      )}
      <section>
        <div className="page-head">
          <div>
            <h1>
              Questions tagged <span className="tag" style={{ fontSize: "1.2rem" }}>{tag.slug}</span>
            </h1>
            <p>{plural(tag.question_count, "question")}</p>
          </div>
        </div>
        <div className="card">
          <SortTabs basePath={base} current={sort} />
          <QuestionList questions={questions} empty={<p>No questions with this tag yet.</p>} />
          <Pagination
            page={page}
            total={total}
            makeHref={(p) => pageHref(base, { sort: sort === "latest" ? undefined : sort, page: p > 1 ? String(p) : undefined })}
          />
        </div>
      </section>
      <Sidebar />
    </div>
  );
}
