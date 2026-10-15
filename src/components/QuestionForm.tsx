"use client";

import { useActionState } from "react";
import { createQuestion, updateQuestion } from "@/app/actions/forum";
import { FormMessage } from "@/components/FormMessage";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { SubmitButton } from "@/components/SubmitButton";
import { Turnstile } from "@/components/Turnstile";
import type { Category } from "@/lib/types";

type Initial = {
  id: number;
  title: string;
  body: string;
  category: string;
  tags: string[];
  image_url: string | null;
};

export function QuestionForm({
  categories,
  initial,
  siteKey = "",
}: {
  categories: Category[];
  initial?: Initial;
  siteKey?: string;
}) {
  const [state, action] = useActionState(initial ? updateQuestion : createQuestion, null);

  return (
    <form action={action} className="form">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {initial?.image_url && <input type="hidden" name="image_url" value={initial.image_url} />}
      <div className="field">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          className="input"
          required
          minLength={15}
          maxLength={150}
          defaultValue={initial?.title}
          placeholder="e.g. How should we design onboarding for a B2B SaaS dashboard?"
        />
        <span className="hint">Be specific — imagine you are asking another designer.</span>
      </div>

      <MarkdownEditor
        name="body"
        label="Details"
        defaultValue={initial?.body}
        required
        minLength={30}
        maxLength={20000}
        allowImages
        hint="Markdown supported: **bold**, _italic_, lists, `code`, links and ![images](https://…). HTML is not allowed."
      />

      <div className="field">
        <label htmlFor="category">Category</label>
        <select id="category" name="category" className="select" required defaultValue={initial?.category ?? ""}>
          <option value="" disabled>
            Choose a category
          </option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="tags">Tags</label>
        <input
          id="tags"
          name="tags"
          className="input"
          required
          defaultValue={initial?.tags.join(", ")}
          placeholder="e.g. onboarding, dashboards, figma"
        />
        <span className="hint">1–5 tags, separated by commas.</span>
      </div>

      <Turnstile siteKey={siteKey} resetKey={state} />
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel={initial ? "Saving…" : "Posting…"}>
          {initial ? "Save changes" : "Post your question"}
        </SubmitButton>
      </div>
    </form>
  );
}
