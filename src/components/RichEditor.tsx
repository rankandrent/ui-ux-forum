"use client";

import Image from "@tiptap/extension-image";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useId, useRef, useState } from "react";
import { uploadImage } from "@/lib/upload-client";

// Reddit-style rich text editor. The form still submits markdown (hidden input), so server-side
// rendering, sanitizing and the no-raw-HTML rule are unchanged. Loaded on demand by MarkdownEditor.

export type RichEditorProps = {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
  allowImages?: boolean;
  placeholder?: string;
};

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  return /^https?:\/\/[^\s]+$/i.test(withScheme) ? withScheme : null;
}

type ToolProps = {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function Tool({ label, shortcut, active, disabled, onClick, children }: ToolProps) {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return (
    <button
      type="button"
      className="rte-btn"
      aria-label={title}
      title={title}
      aria-pressed={active ?? undefined}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} fill="currentColor" />
  </svg>
);

const ICONS = {
  bold: "M8 4h6a4 4 0 0 1 2.9 6.75A4.5 4.5 0 0 1 14.5 20H8V4zm3 3v3.5h3a1.75 1.75 0 0 0 0-3.5h-3zm0 6.5V17h3.5a1.75 1.75 0 0 0 0-3.5H11z",
  italic: "M10 4h8v3h-2.6l-3 10H15v3H7v-3h2.6l3-10H10V4z",
  strike: "M5 11h14v2H5v-2zm7-7c2.8 0 4.7 1.3 5.2 3.5l-2.9.7C14 7 13.2 6.5 12 6.5c-1.4 0-2.3.6-2.3 1.4 0 .6.4 1 1.7 1.4H7.2A3.6 3.6 0 0 1 6.8 8C6.8 5.6 9 4 12 4zm4.9 11c.2.4.3.9.3 1.4 0 2.6-2.3 4.1-5.3 4.1-3 0-5-1.4-5.5-3.8l2.9-.6c.3 1.2 1.2 1.9 2.7 1.9 1.4 0 2.3-.6 2.3-1.5 0-.6-.3-1-1.4-1.5h4z",
  heading: "M5 4h3v6.5h8V4h3v16h-3v-6.5H8V20H5V4z",
  bullet: "M4 6.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM9 5h11v3H9V5zm-5 7a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm5-1.5h11v3H9v-3zM4 17.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM9 16h11v3H9v-3z",
  ordered: "M4 4h2v5H4.8V5.3H4V4zm5 1h11v3H9V5zm0 5.5h11v3H9v-3zM9 16h11v3H9v-3zM3.8 11.2c.3-.8 1-1.2 1.8-1.2 1 0 1.7.6 1.7 1.5 0 .6-.3 1-1 1.6l-.7.6h1.7V15H3.9v-.9l1.8-1.6c.4-.4.5-.6.5-.9 0-.3-.2-.5-.5-.5s-.5.2-.6.5l-1.3-.4zM4 18h2.9v1H5.6l1.3 1.1v.9H4v-1h1.4L4 18.9V18z",
  quote: "M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z",
  code: "M8.7 16.6 4.1 12l4.6-4.6L7.3 6 1.3 12l6 6 1.4-1.4zm6.6 0 4.6-4.6-4.6-4.6L16.7 6l6 6-6 6-1.4-1.4z",
  codeBlock: "M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v12h14V6H5zm4.3 9.4L6 12.1l3.3-3.3 1.4 1.4-1.9 1.9 1.9 1.9-1.4 1.4zm5.4 0-1.4-1.4 1.9-1.9-1.9-1.9 1.4-1.4 3.3 3.3-3.3 3.3z",
  link: "M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0zM8.5 19a4.5 4.5 0 0 1-3.2-7.7l2.1-2.1 1.4 1.4-2.1 2.1a2.5 2.5 0 0 0 3.5 3.5l2.1-2.1 1.4 1.4-2.1 2.1A4.5 4.5 0 0 1 8.5 19zm8.1-4.2-1.4-1.4 2.1-2.1a2.5 2.5 0 0 0-3.5-3.5l-2.1 2.1-1.4-1.4 2.1-2.1a4.5 4.5 0 0 1 6.4 6.4l-2.2 2z",
  image: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2v8.6l3.5-3.5 3 3 4-4L19 14.6V7H5zm3.5 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z",
  undo: "M7.8 8H15a5 5 0 0 1 0 10H8v-2h7a3 3 0 0 0 0-6H7.8l2.6 2.6L9 14 4 9l5-5 1.4 1.4L7.8 8z",
  redo: "M16.2 8 13.6 5.4 15 4l5 5-5 5-1.4-1.4 2.6-2.6H9a3 3 0 0 0 0 6h7v2H9A5 5 0 0 1 9 8h7.2z",
};

function Toolbar({ editor, onLink, onImage, uploading }: {
  editor: Editor;
  onLink: () => void;
  onImage?: () => void;
  uploading: boolean;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      heading: e.isActive("heading"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("code"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const run = () => editor.chain().focus();
  return (
    <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
      <Tool label="Bold" shortcut="Ctrl+B" active={s.bold} onClick={() => run().toggleBold().run()}><Icon d={ICONS.bold} /></Tool>
      <Tool label="Italic" shortcut="Ctrl+I" active={s.italic} onClick={() => run().toggleItalic().run()}><Icon d={ICONS.italic} /></Tool>
      <Tool label="Strikethrough" active={s.strike} onClick={() => run().toggleStrike().run()}><Icon d={ICONS.strike} /></Tool>
      <Tool label="Heading" active={s.heading} onClick={() => run().toggleHeading({ level: 2 }).run()}><Icon d={ICONS.heading} /></Tool>
      <span className="rte-sep" aria-hidden="true" />
      <Tool label="Bulleted list" active={s.bullet} onClick={() => run().toggleBulletList().run()}><Icon d={ICONS.bullet} /></Tool>
      <Tool label="Numbered list" active={s.ordered} onClick={() => run().toggleOrderedList().run()}><Icon d={ICONS.ordered} /></Tool>
      <Tool label="Quote" active={s.quote} onClick={() => run().toggleBlockquote().run()}><Icon d={ICONS.quote} /></Tool>
      <span className="rte-sep" aria-hidden="true" />
      <Tool label="Inline code" active={s.code} onClick={() => run().toggleCode().run()}><Icon d={ICONS.code} /></Tool>
      <Tool label="Code block" active={s.codeBlock} onClick={() => run().toggleCodeBlock().run()}><Icon d={ICONS.codeBlock} /></Tool>
      <Tool label="Link" shortcut="Ctrl+K" active={s.link} onClick={onLink}><Icon d={ICONS.link} /></Tool>
      {onImage && (
        <Tool label={uploading ? "Uploading image…" : "Add image"} disabled={uploading} onClick={onImage}>
          <Icon d={ICONS.image} />
        </Tool>
      )}
      <span className="rte-sep" aria-hidden="true" />
      <Tool label="Undo" shortcut="Ctrl+Z" disabled={!s.canUndo} onClick={() => run().undo().run()}><Icon d={ICONS.undo} /></Tool>
      <Tool label="Redo" shortcut="Ctrl+Shift+Z" disabled={!s.canRedo} onClick={() => run().redo().run()}><Icon d={ICONS.redo} /></Tool>
    </div>
  );
}

export default function RichEditor(props: RichEditorProps) {
  const { name, label, defaultValue = "", hint, minLength, maxLength, required, allowImages, placeholder } = props;
  const id = useId();
  const [markdown, setMarkdown] = useState(defaultValue);
  const [mode, setMode] = useState<"rich" | "markdown">("rich");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);

  async function insertImages(files: File[]) {
    const images = files.filter((f) => IMAGE_TYPES.includes(f.type));
    if (!allowImages || images.length === 0) return false;
    setError(null);
    setUploading(true);
    try {
      for (const file of images) {
        const src = await uploadImage(file, "question");
        editorRef.current?.chain().focus().setImage({ src, alt: "image" }).run();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
    return true;
  }

  function promptLink() {
    const editor = editorRef.current;
    if (!editor) return;
    const current = (editor.getAttributes("link").href as string | undefined) ?? "";
    const input = window.prompt("Link URL (leave empty to remove)", current || "https://");
    if (input === null) return;
    const href = safeUrl(input === "https://" ? "" : input);
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!href) {
      chain.unsetLink().run();
      return;
    }
    if (editor.state.selection.empty && !editor.isActive("link")) {
      editor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        underline: false, // markdown has no underline
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ["http", "https"],
          defaultProtocol: "https",
          HTMLAttributes: { rel: "ugc nofollow noopener", target: null },
        },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Write here…" }),
      CharacterCount.configure({ limit: maxLength }),
      Markdown,
    ],
    content: defaultValue,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "rte-content prose",
        "aria-labelledby": `${id}-label`,
        "aria-multiline": "true",
        role: "textbox",
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          promptLink();
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!allowImages || !files.some((f) => IMAGE_TYPES.includes(f.type))) return false;
        event.preventDefault();
        void insertImages(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        if (!allowImages || !files.some((f) => IMAGE_TYPES.includes(f.type))) return false;
        event.preventDefault();
        void insertImages(files);
        return true;
      },
    },
    onCreate: ({ editor: e }) => {
      editorRef.current = e;
    },
    onUpdate: ({ editor: e }) => setMarkdown(e.getMarkdown()),
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  function switchMode() {
    if (!editor) return;
    if (mode === "rich") {
      setMarkdown(editor.getMarkdown());
      setMode("markdown");
    } else {
      editor.commands.setContent(markdown, { contentType: "markdown" });
      setMode("rich");
    }
  }

  const length = markdown.trim().length;
  const tooShort = minLength !== undefined && length > 0 && length < minLength;

  return (
    <div className="field">
      <div className="rte-head">
        <label id={`${id}-label`} htmlFor={mode === "markdown" ? `${id}-md` : undefined}>
          {label}
          {required && <span className="sr-only"> (required)</span>}
        </label>
        <button type="button" className="rte-mode" onClick={switchMode} disabled={!editor}>
          {mode === "rich" ? "Markdown mode" : "Switch to rich text"}
        </button>
      </div>

      <div className={`rte${mode === "markdown" ? " rte-markdown" : ""}`}>
        {mode === "rich" && editor && (
          <Toolbar
            editor={editor}
            onLink={promptLink}
            onImage={allowImages ? () => fileInput.current?.click() : undefined}
            uploading={uploading}
          />
        )}
        {mode === "rich" ? (
          <EditorContent editor={editor} />
        ) : (
          <textarea
            id={`${id}-md`}
            className="textarea"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            maxLength={maxLength}
            spellCheck
          />
        )}
      </div>

      <input type="hidden" name={name} value={markdown} />
      {allowImages && (
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          multiple
          hidden
          onChange={(e) => {
            void insertImages(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      )}

      <div className="rte-foot">
        <span className="hint">
          {hint ?? (allowImages ? "Paste or drag images in, or use the image button." : "")}
        </span>
        {maxLength && (
          <span className={`hint rte-count${tooShort ? " rte-count-warn" : ""}`} aria-live="polite">
            {tooShort ? `${minLength! - length} more characters needed · ` : ""}
            {length.toLocaleString()} / {maxLength.toLocaleString()}
          </span>
        )}
      </div>
      {uploading && <p className="hint" role="status">Uploading image…</p>}
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
