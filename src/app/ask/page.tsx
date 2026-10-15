import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuestionForm } from "@/components/QuestionForm";
import { getCategories } from "@/lib/queries";
import { getViewer } from "@/lib/supabase/server";
import { challengeSiteKey } from "@/lib/turnstile";

export const metadata: Metadata = { title: "Ask a question", robots: { index: false } };

export default async function AskPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login/?next=/ask/");
  const categories = await getCategories();

  return (
    <div className="layout">
      <section className="card card-pad">
        <h1>Ask a question</h1>
        <p className="hint" style={{ marginBottom: 20 }}>
          Share context — product type, users, constraints and what you have tried. Good questions get better answers.
        </p>
        <QuestionForm categories={categories} siteKey={challengeSiteKey(viewer)} />
      </section>
      <aside className="sidebar">
        <section className="card card-pad">
          <h2>Tips</h2>
          <ul className="hint" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Summarize the problem in the title.</li>
            <li>Describe your product and audience.</li>
            <li>Add screenshots with the “Add image” button.</li>
            <li>Don’t share private or confidential data.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
