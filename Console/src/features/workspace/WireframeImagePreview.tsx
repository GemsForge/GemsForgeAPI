import { useState } from "react";

export function WireframeImagePreview({ src, alt, className = "wireframe-property-image" }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="wireframe-image-preview-trigger" aria-label={`View larger ${alt}`} onClick={() => setOpen(true)}>
        <img className={className} src={src} alt={alt} />
      </button>
      {open ? (
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
