import type { ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";
import { GemPageTitle } from "@gemsforge/ui";

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
      <nav className="demo-expanded-breadcrumb wireframe-record-page-breadcrumb" aria-label="Record location">
        <button type="button" onClick={onBack}>
          {collectionTitle}
        </button>
        <span aria-hidden="true">›</span>
        <span>{recordTitle}</span>
      </nav>
      <div className="wireframe-record-page-heading">
        <p>Record page</p>
        <GemPageTitle id="wireframe-record-page-title" color="$wireframeHeading">
          {recordTitle}
        </GemPageTitle>
      </div>
      <div className="wireframe-record-page-content">{children}</div>
    </main>
  );
}
