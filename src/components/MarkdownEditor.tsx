"use client";

import { useId, useMemo, useRef, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { uploadImage } from "@/lib/upload-client";

type Props = {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  minLength?: number;
  maxLength?: number;
  small?: boolean;
  required?: boolean;
  /** Show an "Add image" button that uploads the image and inserts the markdown. */
  allowImages?: boolean;
};

export function MarkdownEditor(props: Props) {
  const { name, label, defaultValue = "", hint, minLength, maxLength, small, required, allowImages } = props;
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const html = useMemo(() => (tab === "preview" ? renderMarkdown(value) : ""), [tab, value]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file, "question");
      const el = textarea.current;
      const at = el ? el.selectionEnd : value.length;
      const snippet = `${at > 0 && value[at - 1] !== "\n" ? "\n\n" : ""}![image](${url})\n`;
      setValue(value.slice(0, at) + snippet + value.slice(at));
      setTab("write");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

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
        ref={textarea}
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
      {allowImages && (
        <div className="editor-tools">
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <button type="button" className="btn btn-ghost" disabled={uploading} onClick={() => fileInput.current?.click()}>
            {uploading ? "Uploading…" : "Add image"}
          </button>
          <span className="hint">PNG, JPG, WebP or GIF. Large photos are resized automatically.</span>
        </div>
      )}
      {uploadError && (
        <p className="alert alert-error" role="alert">
          {uploadError}
        </p>
      )}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
