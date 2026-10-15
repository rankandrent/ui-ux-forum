"use client";

import { useId, useMemo, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";

type Props = {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  minLength?: number;
  maxLength?: number;
  small?: boolean;
  required?: boolean;
};

export function MarkdownEditor({ name, label, defaultValue = "", hint, minLength, maxLength, small, required }: Props) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const html = useMemo(() => (tab === "preview" ? renderMarkdown(value) : ""), [tab, value]);

  return (
    <div className="field">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label htmlFor={id}>{label}</label>
        <div className="editor-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "write"} onClick={() => setTab("write")}>
            Write
          </button>
          <button type="button" role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")}>
            Preview
          </button>
        </div>
      </div>
      <textarea
        id={id}
        name={name}
        className={`textarea${small ? " small" : ""}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        minLength={minLength}
        maxLength={maxLength}
        required={required}
        hidden={tab === "preview"}
      />
      {tab === "preview" && (
        <div className="preview prose" dangerouslySetInnerHTML={{ __html: html || "<p>Nothing to preview.</p>" }} />
      )}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
