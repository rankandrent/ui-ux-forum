import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Pagination, pageHref } from "@/components/Pagination";
import { QuestionList } from "@/components/QuestionList";
import { Sidebar } from "@/components/Sidebar";
import { SortTabs } from "@/components/SortTabs";
import { plural } from "@/lib/format";
import { listQuestions } from "@/lib/queries";
import { env } from "@/lib/env";
import { websiteJsonLd } from "@/lib/schema";
import { parsePage, parseSort } from "@/lib/site";
import { INDEX_ROBOTS, NOINDEX_ROBOTS, OG_IMAGES } from "@/lib/seo";

export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const sorted = sp.sort !== undefined;
  return {
    // Page N is its own canonical; sort variants are noindex and point at the default listing.
    alternates: { canonical: page > 1 && !sorted ? `/?page=${page}` : "/" },
    robots: sorted ? NOINDEX_ROBOTS : INDEX_ROBOTS,
    openGraph: { url: "/", images: OG_IMAGES },
  };
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const sort = parseSort(params.sort);
  const page = parsePage(params.page);
  const { questions, total } = await listQuestions({ sort, page });
  if (page > 1 && questions.length === 0) notFound();

  return (
    <div className="layout">
      <JsonLd data={websiteJsonLd(env.siteUrl)} />
      <section>
        <div className="page-head">
          <div>
            <h1>UI/UX design questions</h1>
            <p>Ask about research, UI, SaaS and AI products, design costs and hiring — {plural(total, "question")}.</p>
          </div>
          <Link className="btn btn-primary" href="/ask/">
            Ask a question
          </Link>
        </div>
        <div className="card">
          <SortTabs basePath="/" current={sort} />
          <QuestionList
            questions={questions}
            empty={
              <>
                <p>No questions here yet.</p>
                <Link className="btn btn-primary" href="/ask/">
                  Ask the first question
                </Link>
              </>
            }
          />
          <Pagination
            page={page}
            total={total}
            makeHref={(p) => pageHref("/", { sort: sort === "latest" ? undefined : sort, page: p > 1 ? String(p) : undefined })}
          />
        </div>
      </section>
      <Sidebar />
    </div>
  );
}
