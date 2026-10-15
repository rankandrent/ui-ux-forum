"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { uploadImage } from "@/lib/upload-client";

export function AvatarUpload({ name, src }: { name: string; src: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(src);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      setCurrent(await uploadImage(file, "avatar"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="avatar-upload">
      <Avatar name={name} src={current} size={72} />
      <div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Uploading…" : "Change photo"}
        </button>
        <p className="hint" style={{ margin: "4px 0 0" }}>
          Square PNG, JPG or WebP, up to 1 MB.
        </p>
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
