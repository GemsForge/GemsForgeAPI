import { useRef, useState } from "react";
import { Pencil } from "lucide-react";

export function WireframeImagePreview({
  src,
  alt,
  className = "wireframe-property-image",
  onEdit,
}: {
  src?: string;
  alt: string;
  className?: string;
  onEdit?: (file: File) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = async (file?: File) => {
    if (!file || !onEdit) return;
    setBusy(true);
    setError(undefined);
    try {
      await onEdit(file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this image.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  return (
    <>
      <span className="wireframe-image-preview-row">
        {src ? (
          <button type="button" className="wireframe-image-preview-trigger" aria-label={`View larger ${alt}`} onClick={() => setOpen(true)}>
            <img className={className} src={src} alt={alt} />
          </button>
        ) : <span className="wireframe-image-empty">No image</span>}
        {onEdit ? (
          <>
            <input
              ref={fileInputRef}
              className="wireframe-image-edit-input"
              type="file"
              accept="image/*"
              aria-label={`Choose ${src ? "replacement " : ""}image for ${alt}`}
              disabled={busy}
              onChange={(event) => void upload(event.currentTarget.files?.[0])}
            />
            <button
              type="button"
              className="wireframe-value-edit-trigger"
              aria-label={`Edit ${alt}`}
              title={`Edit ${alt}`}
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
          </>
        ) : null}
      </span>
      {busy ? <span className="wireframe-image-edit-status" role="status">Saving image…</span> : null}
      {error ? <span className="wireframe-image-edit-error" role="alert">{error}</span> : null}
      {open && src ? (
        <div className="wireframe-image-lightbox" role="presentation" onClick={() => setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label={`${alt} enlarged`} onClick={(event) => event.stopPropagation()}>
            <button type="button" aria-label="Close enlarged image" onClick={() => setOpen(false)}>×</button>
            <img src={src} alt={alt} />
          </section>
        </div>
      ) : null}
    </>
  );
}
