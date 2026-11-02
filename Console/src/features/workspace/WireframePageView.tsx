import type { ReactNode } from "react";

type WireframePageViewProps = {
  title: string;
  description: string;
  recordCount: number;
  children: ReactNode;
};

export function WireframePageView({ title, description, recordCount, children }: WireframePageViewProps) {
  return (
    <main className="wireframe-demo-main" aria-labelledby="wireframe-page-title">
      <header className="demo-collection-header"><div className="demo-collection-title"><span className="demo-collection-icon">✦</span><div><h2 id="wireframe-page-title">{title}</h2><p>{description}</p></div></div><span className="demo-record-count">{recordCount} records</span><button type="button" className="demo-icon-button" aria-label="More collection actions">•••</button></header>
      {children}
    </main>
  );
}
