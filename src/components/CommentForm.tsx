"use client";

import { useActionState, useState } from "react";
import { createComment } from "@/app/actions/forum";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { Turnstile } from "@/components/Turnstile";
import type { ActionResult } from "@/lib/types";

export function CommentForm({
  questionId,
  answerId,
  siteKey = "",
}: {
  questionId: number;
  answerId?: number;
  siteKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await createComment(prev, formData);
    if (result?.ok) setOpen(false);
    return result;
  }, null);

  if (!open)
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Add a comment
      </button>
    );

  return (
    <form action={action} className="form" style={{ gap: 8, marginTop: 8 }}>
      <input type="hidden" name="question_id" value={questionId} />
      {answerId && <input type="hidden" name="answer_id" value={answerId} />}
      <label className="sr-only" htmlFor={`comment-${answerId ?? "q"}`}>
        Comment
      </label>
      <textarea
        id={`comment-${answerId ?? "q"}`}
        name="body"
        className="textarea small"
        required
        minLength={5}
        maxLength={1000}
        placeholder="Ask for clarification or suggest an improvement"
        autoFocus
      />
      <Turnstile siteKey={siteKey} resetKey={state} />
      <FormMessage state={state && !state.ok ? state : null} />
      <div style={{ display: "flex", gap: 8 }}>
        <SubmitButton className="btn btn-primary" pendingLabel="Posting…">
          Comment
        </SubmitButton>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
