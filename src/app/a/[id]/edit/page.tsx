import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EditAnswerForm } from "@/components/AnswerForm";
import { questionPath } from "@/lib/site";
import { createClient, getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit answer", robots: { index: false } };

export default async function EditAnswerPage({ params }: PageProps<"/a/[id]/edit">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const supabase = await createClient();
  const { data: answer } = await supabase
    .from("answers")
    .select("id, body, author_id, question:questions!answers_question_id_fkey(id, slug, title)")
    .eq("id", id)
    .maybeSingle<{ id: number; body: string; author_id: string | null; question: { id: number; slug: string; title: string } }>();
  if (!answer) notFound();
  const back = questionPath(answer.question.id, answer.question.slug);

  const viewer = await getViewer();
  if (!viewer) redirect(`/login/?next=${encodeURIComponent(`/a/${id}/edit/`)}`);
  const staff = viewer.role === "admin" || viewer.role === "moderator";
  if (viewer.id !== answer.author_id && !staff) redirect(back);

  return (
    <section className="card card-pad" style={{ maxWidth: 860 }}>
      <h1>Edit answer</h1>
      <p className="hint">
        For: <a href={back}>{answer.question.title}</a>
      </p>
      <EditAnswerForm id={answer.id} body={answer.body} back={back} />
    </section>
  );
}
