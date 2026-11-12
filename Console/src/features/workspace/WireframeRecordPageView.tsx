import type { ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";
import { GemPageTitle } from "@gemsforge/ui";

type WireframeRecordPageViewProps = {
  collectionTitle: string;
  recordTitle: string;
  cover?: ReactNode;
  emoji?: string | null;
  children: ReactNode;
  onBack: () => void;
  onClose: () => void;
};

/** Dedicated full-page record view used by collection record routes. */
export function WireframeRecordPageView({
  collectionTitle,
  recordTitle,
  cover,
  emoji,
  children,
  onBack,
  onClose,
}: WireframeRecordPageViewProps) {
  return (
    <main className="wireframe-record-page" aria-labelledby="wireframe-record-page-title">
      <header className="wireframe-record-page-header">
        <button
          type="button"
          className="wireframe-record-page-action"
          aria-label="Back to collection"
          title="Back to collection"
          onClick={onBack}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="wireframe-record-page-action wireframe-record-page-close"
          aria-label="Close record page"
          title="Close record page"
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      {cover ? (
        <div className="wireframe-record-page-cover-wrap">
          {cover}
          {emoji ? (
            <span className="wireframe-record-page-emoji" aria-hidden="true">{emoji}</span>
          ) : null}
        </div>
      ) : null}
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
