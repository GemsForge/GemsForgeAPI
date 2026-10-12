import { useRef, useState } from "react";
import { api } from "../api";
import type { FileMetadata } from "../types";

interface AttachmentControlProps {
  fileMetadataID: string | null | undefined;
  ownerType: string;
  ownerID: string;
  label: string;
  onAttach: (metadata: FileMetadata | null) => Promise<void>;
}

/** Reusable browser control for upload, replacement, preview, and removal. */
export function AttachmentControl({ fileMetadataID, ownerType, ownerID, label, onAttach }: AttachmentControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
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

  async function remove() {
    setBusy(true);
    setError(null);
    try { await onAttach(null); } catch (caught) { setError(caught instanceof Error ? caught.message : "Removal failed."); }
    finally { setBusy(false); }
  }

  return <div className="attachment-control">
    <div className="attachment-heading"><div><p className="eyebrow">Attachment</p><strong>{label}</strong></div>{fileMetadataID && <button className="text-button" onClick={() => void remove()} disabled={busy}>Remove</button>}</div>
    {fileMetadataID ? <img className="attachment-preview" src={api.fileContentURL(fileMetadataID)} alt={`${label} preview`} /> : <div className="attachment-empty">No file attached yet.</div>}
    <input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); event.target.value = ""; }} />
    <button className="secondary-button" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? "Uploading…" : fileMetadataID ? "Replace image" : "Choose image"}</button>
    {error && <p className="attachment-error">{error}</p>}
  </div>;
}
