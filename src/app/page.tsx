import Link from "next/link";
import { Pagination, pageHref } from "@/components/Pagination";
import { QuestionList } from "@/components/QuestionList";
import { Sidebar } from "@/components/Sidebar";
import { SortTabs } from "@/components/SortTabs";
import { plural } from "@/lib/format";
import { listQuestions } from "@/lib/queries";
import { parsePage, parseSort } from "@/lib/site";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const sort = parseSort(params.sort);
  const page = parsePage(params.page);
  const { questions, total } = await listQuestions({ sort, page });

  return (
    <div className="layout">
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
