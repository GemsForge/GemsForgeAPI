import { useRef, useState } from "react";
import { api } from "../api";
import type { FileMetadata } from "../types";
import { FilePresentation } from "./FilePresentation";

interface AttachmentControlProps {
  fileMetadataID: string | null | undefined;
  ownerType: string;
  ownerID: string;
  label: string;
  onAttach: (metadata: FileMetadata | null) => Promise<void>;
  /** Future native picker adapter returns a File or null when cancelled. */
  selectImage?: () => Promise<File | null>;
}

/** Reusable browser control for upload, replacement, preview, and removal. */
export function AttachmentControl({ fileMetadataID, ownerType, ownerID, label, onAttach, selectImage }: AttachmentControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file.type.toLowerCase().startsWith("image/") || file.size === 0) {
      setError("Choose a non-empty image file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const metadata = await api.uploadImage(file, label.toLowerCase().replaceAll(" ", "-"), ownerType, ownerID);
      await onAttach(metadata);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function choose() {
    if (!selectImage) { inputRef.current?.click(); return; }
    setBusy(true);
    setError(null);
    try {
      const file = await selectImage();
      if (file) await handleFile(file);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "File selection failed.");
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try { await onAttach(null); } catch (caught) { setError(caught instanceof Error ? caught.message : "Removal failed."); }
    finally { setBusy(false); }
  }

  return <div className="attachment-control">
    <div className="attachment-heading"><div><p className="eyebrow">Attachment</p><strong>{label}</strong></div>{fileMetadataID && <button className="text-button" onClick={() => void remove()} disabled={busy}>Remove</button>}</div>
    <FilePresentation fileMetadataID={fileMetadataID} label={label} />
    <input ref={inputRef} type="file" accept="image/*" aria-label={`Choose ${label.toLowerCase()}`} hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); event.target.value = ""; }} />
    <button className="secondary-button" onClick={() => void choose()} disabled={busy}>{busy ? "Working…" : fileMetadataID ? "Replace image" : "Choose image"}</button>
    {error && <p className="attachment-error" role="alert">{error}</p>}
  </div>;
}
