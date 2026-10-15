"use client";

import dynamic from "next/dynamic";
import type { RichEditorProps } from "@/components/RichEditor";

// The rich editor (Tiptap) is only downloaded on pages that render a form with it.
// A skeleton shows while it loads (a few hundred ms).
const RichEditor = dynamic(() => import("@/components/RichEditor"), {
  ssr: false,
  loading: () => (
    <div className="field">
      <span className="rte-loading-label">Loading editor…</span>
      <div className="rte rte-skeleton" aria-hidden="true" />
    </div>
  ),
});

export function MarkdownEditor(props: RichEditorProps) {
  return <RichEditor {...props} />;
}
