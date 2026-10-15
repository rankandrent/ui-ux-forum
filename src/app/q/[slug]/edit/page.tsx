import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { QuestionForm } from "@/components/QuestionForm";
import { getCategories, getQuestion } from "@/lib/queries";
import { parseQuestionParam, questionPath } from "@/lib/site";
import { getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit question", robots: { index: false } };

export default async function EditQuestionPage({ params }: PageProps<"/q/[slug]/edit">) {
  const id = parseQuestionParam((await params).slug);
  const question = id ? await getQuestion(id) : null;
  if (!question) notFound();
  const path = questionPath(question.id, question.slug);

  const viewer = await getViewer();
  if (!viewer) redirect(`/login/?next=${encodeURIComponent(`${path}edit/`)}`);
  const staff = viewer.role === "admin" || viewer.role === "moderator";
  if (viewer.id !== question.author_id && !staff) redirect(path);

  const categories = await getCategories();
  return (
    <section className="card card-pad" style={{ maxWidth: 860 }}>
      <h1>Edit question</h1>
      <QuestionForm
        categories={categories}
        initial={{
          id: question.id,
          title: question.title,
          body: question.body,
          category: question.category?.slug ?? "",
          tags: question.tags,
          image_url: question.image_url,
        }}
      />
    </section>
  );
}
