import type { ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";

type WireframeRecordPageViewProps = {
  collectionTitle: string;
  recordTitle: string;
  cover?: ReactNode;
  children: ReactNode;
  onBack: () => void;
  onClose: () => void;
};

/** Dedicated full-page record view used by collection record routes. */
export function WireframeRecordPageView({
  collectionTitle,
  recordTitle,
  cover,
  children,
  onBack,
  onClose,
}: WireframeRecordPageViewProps) {
  return (
    <main className="wireframe-record-page" aria-labelledby="wireframe-record-page-title">
      <header className="wireframe-record-page-header">
        <nav className="demo-expanded-breadcrumb" aria-label="Record location">
          <button type="button" onClick={onBack}>{collectionTitle}</button>
          <span aria-hidden="true">›</span>
          <span>{recordTitle}</span>
        </nav>
        <div className="demo-inspector-actions">
          <button type="button" aria-label="Back to collection" title="Back to collection" onClick={onBack}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Close record page" title="Close record page" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </header>
      {cover}
      <div className="wireframe-record-page-heading">
        <p>Record page</p>
        <h1 id="wireframe-record-page-title">{recordTitle}</h1>
      </div>
      <div className="wireframe-record-page-content">{children}</div>
    </main>
  );
}
