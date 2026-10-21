import type { ReactNode } from "react";

/** Shared collection boundary for record tools and the list/form content they govern. */
export function RecordCollection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`record-collection ${className}`.trim()}>{children}</section>;
}
