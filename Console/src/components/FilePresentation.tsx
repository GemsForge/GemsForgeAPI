import { useEffect, useState } from "react";
import { api, APIError } from "../api";
import { useFileMetadataQuery } from "../data/fileQueries";
import type { FileMetadata } from "../types";
import { GemButton, GemEmptyState, GemLoadingState } from "./ui";

export interface FilePresentationProps {
  fileMetadataID?: string | null;
  label: string;
}

/** Shared presentation boundary for stored attachments, independent of selection. */
export function FilePresentation({ fileMetadataID, label }: FilePresentationProps) {
  if (!fileMetadataID) {
    return <div className="file-presentation"><GemEmptyState title="No file attached" description="Choose an image to attach to this record." /></div>;
  }
  // A new attachment gets a new viewer, so late loads cannot affect another record.
  return <StoredFile key={fileMetadataID} id={fileMetadataID} label={label} />;
}

function StoredFile({ id, label }: { id: string; label: string }) {
  const metadata = useFileMetadataQuery(id);
  if (metadata.isPending) return <div className="file-presentation"><GemLoadingState label="Loading file details…" /></div>;
  if (metadata.isError) {
    const missing = metadata.error instanceof APIError && metadata.error.status === 404;
    return <div className="file-presentation">
      <p role="alert">{missing ? "File record not found." : "File details could not be loaded."}</p>
      <GemButton tone="secondary" onPress={() => void metadata.refetch()}>Retry file details</GemButton>
    </div>;
  }

  const file = metadata.data;
  const name = file.fileName || file.relativePath.split("/").pop() || "Unnamed file";
  return <div className="file-presentation">
    <dl className="file-metadata" aria-label={`${label} file details`}>
      <div><dt>File name</dt><dd>{name}</dd></div>
      <div><dt>Kind</dt><dd>{file.fileKind}</dd></div>
      <div><dt>Type</dt><dd>{file.mimeType}</dd></div>
      <div><dt>Size</dt><dd>{file.byteSize === null ? "Unknown" : `${file.byteSize.toLocaleString()} bytes`}</dd></div>
    </dl>
    {file.mimeType.toLowerCase().startsWith("image/")
      ? <ImagePreview key={`${id}:${file.relativePath}:${file.mimeType}`} file={file} label={label} />
      : <p role="status">Preview is not available for this file type.</p>}
  </div>;
}

type PreviewState =
  | { type: "loading" }
  | { type: "image"; url: string; loaded: boolean }
  | { type: "missing" | "invalid" | "error" };

function ImagePreview({ file, label }: { file: FileMetadata; label: string }) {
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<PreviewState>({ type: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let objectURL: string | undefined;
    setPreview({ type: "loading" });
    void api.getFileContent(file.id, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      if (blob.size === 0 || !blob.type.toLowerCase().startsWith("image/")) {
        setPreview({ type: "invalid" });
        return;
      }
      objectURL = URL.createObjectURL(blob);
      setPreview({ type: "image", url: objectURL, loaded: false });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setPreview({ type: error instanceof APIError && error.status === 404 ? "missing" : "error" });
    });
    return () => {
      controller.abort();
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [file.id, attempt]);

  const loading = preview.type === "loading" || (preview.type === "image" && !preview.loaded);
  const failed = preview.type === "missing" || preview.type === "invalid" || preview.type === "error";
  return <div className="file-preview" aria-busy={loading}>
    {loading && <GemLoadingState label="Loading image preview…" />}
    {preview.type === "image" && <img className="attachment-preview" decoding="async" src={preview.url} alt={`${label} preview`}
      hidden={!preview.loaded}
      onLoad={() => setPreview((current) => current.type === "image" ? { ...current, loaded: true } : current)}
      onError={() => setPreview({ type: "invalid" })} />}
    {failed && <>
      <p role="alert">{preview.type === "missing" ? "The attached file is missing from storage."
        : preview.type === "invalid" ? "This file cannot be displayed as an image. It may be damaged or unsupported."
          : "The image preview could not be loaded."}</p>
      <GemButton tone="secondary" onPress={() => setAttempt((value) => value + 1)}>Retry image preview</GemButton>
    </>}
  </div>;
}
