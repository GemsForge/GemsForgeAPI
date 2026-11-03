import { GemLogo } from "@gemsforge/ui";

export function WireframeWorkspaceHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="demo-brand" aria-label="GemsForge application">
      <GemLogo compact={compact} />
    </header>
  );
}
