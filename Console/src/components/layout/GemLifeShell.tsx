import type { ReactNode } from "react";

interface GemLifeShellProps {
  children: ReactNode;
  sidebar: ReactNode;
}

/** Shared application frame for the Gem Life interface. */
export function GemLifeShell({ children, sidebar }: GemLifeShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="topbar">
        <div>
          <p className="eyebrow">GemsForgeAPI · React testing console</p>
          <h1>Gem Life Console</h1>
        </div>
        <div className="connection-pill"><span /> Local API</div>
      </header>
      <main className="workspace">
        {sidebar}
        <section className="content" id="main-content" tabIndex={-1} aria-label="Current screen">{children}</section>
      </main>
    </div>
  );
}
