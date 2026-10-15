import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pagination, pageHref } from "@/components/Pagination";
import { QuestionList } from "@/components/QuestionList";
import { Sidebar } from "@/components/Sidebar";
import { SortTabs } from "@/components/SortTabs";
import { plural } from "@/lib/format";
import { getTagBySlug, listQuestions } from "@/lib/queries";
import { parsePage, parseSort } from "@/lib/site";

export async function generateMetadata({ params, searchParams }: PageProps<"/t/[tag]">): Promise<Metadata> {
  const tag = await getTagBySlug((await params).tag);
  if (!tag) return {};
  const sp = await searchParams;
  const thin = tag.question_count < 3 || sp.sort !== undefined || sp.page !== undefined;
  return {
    title: `Questions tagged ${tag.slug}`,
    description: `UI/UX design questions about ${tag.slug}.`,
    alternates: { canonical: `/t/${tag.slug}/` },
    robots: thin ? { index: false, follow: true } : undefined,
  };
}

export default async function TagPage({ params, searchParams }: PageProps<"/t/[tag]">) {
  const tag = await getTagBySlug((await params).tag);
  if (!tag) notFound();
  const sp = await searchParams;
  const sort = parseSort(sp.sort);
  const page = parsePage(sp.page);
  const { questions, total } = await listQuestions({ sort, page, tagId: tag.id });
  const base = `/t/${tag.slug}/`;

  return (
    <div className="layout">
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
