import { useRef } from "react";
import { useAttachmentWorkflow } from "../hooks/useAttachmentWorkflow";
import type { FileMetadata } from "../types";
import { FilePresentation } from "./FilePresentation";
import { hasNativeFilePicker, pickNativeFile } from "../bridge/filePicker";

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
export function AttachmentControl({
  fileMetadataID,
  ownerType,
  ownerID,
  label,
  onAttach,
  selectImage,
}: AttachmentControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    busy,
    error,
    handleFile,
    choose: select,
    remove,
  } = useAttachmentWorkflow({ label, ownerType, ownerID, onAttach });
  async function choose() {
    if (selectImage) await select(selectImage);
    else if (hasNativeFilePicker()) await select(() => pickNativeFile("image"));
    else inputRef.current?.click();
  }

  return (
    <div className="attachment-control">
      <div className="attachment-heading">
        <div>
          <p className="eyebrow">Attachment</p>
          <strong>{label}</strong>
        </div>
        {fileMetadataID && (
          <button className="text-button" onClick={() => void remove()} disabled={busy}>
            Remove
          </button>
        )}
      </div>
      <FilePresentation fileMetadataID={fileMetadataID} label={label} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label={`Choose ${label.toLowerCase()}`}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />
      <button className="secondary-button" onClick={() => void choose()} disabled={busy}>
        {busy ? "Working…" : fileMetadataID ? "Replace image" : "Choose image"}
      </button>
      {error && (
        <p className="attachment-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
