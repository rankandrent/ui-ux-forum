"use client";

import { useActionState, useState } from "react";
import { createAnswer, updateAnswer } from "@/app/actions/forum";
import { FormMessage } from "@/components/FormMessage";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { SubmitButton } from "@/components/SubmitButton";
import { Turnstile } from "@/components/Turnstile";
import type { ActionResult } from "@/lib/types";

export function AnswerForm({ questionId, siteKey = "" }: { questionId: number; siteKey?: string }) {
  const [posted, setPosted] = useState(0);
  const [state, action] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await createAnswer(prev, formData);
    if (result?.ok) setPosted((n) => n + 1);
    return result;
  }, null);

  return (
    <form action={action} className="form">
      <input type="hidden" name="question_id" value={questionId} />
      <MarkdownEditor key={posted} name="body" label="Your answer" placeholder="Share what worked for you — steps, examples, links." required minLength={30} maxLength={20000} allowImages />
      <Turnstile siteKey={siteKey} resetKey={state} />
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Posting…">Post your answer</SubmitButton>
      </div>
    </form>
  );
}

export function EditAnswerForm({ id, body, back }: { id: number; body: string; back: string }) {
  const [state, action] = useActionState(updateAnswer, null);
  return (
    <form action={action} className="form">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <MarkdownEditor name="body" label="Answer" defaultValue={body} required minLength={30} maxLength={20000} allowImages />
      <FormMessage state={state} />
      <div>
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}
