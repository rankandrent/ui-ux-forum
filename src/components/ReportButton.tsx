"use client";

import { useActionState, useState } from "react";
import { createReport } from "@/app/actions/forum";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

const REASONS = [
  { value: "spam", label: "Spam or advertising" },
  { value: "offensive", label: "Rude or abusive" },
  { value: "off_topic", label: "Off-topic" },
  { value: "low_quality", label: "Low quality" },
  { value: "other", label: "Something else" },
];

type Target = "question" | "answer" | "comment" | "user";

export function ReportButton({ type, id, small }: { type: Target; id: string | number; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createReport, null);
  const formId = `report-${type}-${id}`;

  if (state?.ok) return <FormMessage state={state} />;
  if (!open)
    return (
      <button type="button" className={`btn btn-ghost${small ? " btn-xs" : ""}`} onClick={() => setOpen(true)}>
        {small ? "report" : "Report"}
      </button>
    );

  return (
    <form action={action} className="report-form" aria-label={`Report this ${type}`}>
      <input type="hidden" name="target_type" value={type} />
      <input type="hidden" name="target_id" value={String(id)} />
      <label htmlFor={`${formId}-reason`}>Why are you reporting this {type}?</label>
      <select id={`${formId}-reason`} name="reason" className="select" required defaultValue="">
        <option value="" disabled>
          Choose a reason
        </option>
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`${formId}-details`}>
        Details
      </label>
      <textarea
        id={`${formId}-details`}
        name="details"
        className="textarea small"
        maxLength={500}
        placeholder="Optional details for moderators"
      />
      <FormMessage state={state} />
      <div style={{ display: "flex", gap: 8 }}>
        <SubmitButton pendingLabel="Sending…">Send report</SubmitButton>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
