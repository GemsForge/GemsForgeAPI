import { GemLogo } from "@gemsforge/ui";

export function WireframeWorkspaceHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="demo-brand" aria-label="GemLife Console application">
      <GemLogo compact={compact} />
    </header>
  );
}
