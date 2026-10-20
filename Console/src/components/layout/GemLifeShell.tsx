import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";

interface GemLifeShellProps {
  children: ReactNode;
  sidebar: ReactNode;
}

/** Shared application frame for the Gem Life interface. */
export function GemLifeShell({ children, sidebar }: GemLifeShellProps) {
  const { signOut } = useAuth();
  const workspaceRef = useRef<HTMLElement>(null);
  const resizingRef = useRef(false);
  const manuallyResizedRef = useRef(false);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= 900 ? 68 : 288,
  );

  const resizeSidebar = (width: number) => setSidebarWidth(Math.min(360, Math.max(68, width)));

  useEffect(() => {
    const handleWindowResize = () => {
      if (!manuallyResizedRef.current) resizeSidebar(window.innerWidth <= 900 ? 68 : 288);
    };
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!resizingRef.current) return;
    const workspaceLeft = workspaceRef.current?.getBoundingClientRect().left ?? 0;
    resizeSidebar(event.clientX - workspaceLeft);
  };

  const handleResizeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    manuallyResizedRef.current = true;
    if (event.key === "Home") resizeSidebar(68);
    else if (event.key === "End") resizeSidebar(360);
    else resizeSidebar(sidebarWidth + (event.key === "ArrowRight" ? 16 : -16));
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <div>
          <p className="eyebrow">GemsForgeAPI · React testing console</p>
          <h1>Gem Life Console</h1>
        </div>
        <div className="header-actions">
          <div className="connection-pill">Private workspace</div>
          <button type="button" className="secondary-button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main
        ref={workspaceRef}
        className="workspace"
        data-sidebar-collapsed={sidebarWidth < 160}
        style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
      >
        {sidebar}
        <div
          className="sidebar-resizer"
          role="separator"
          aria-label="Resize navigation pane"
          aria-orientation="vertical"
          aria-valuemin={68}
          aria-valuemax={360}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onKeyDown={handleResizeKey}
          onDoubleClick={() => {
            manuallyResizedRef.current = true;
            resizeSidebar(sidebarWidth < 160 ? 288 : 68);
          }}
          onPointerDown={(event) => {
            manuallyResizedRef.current = true;
            resizingRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => {
            resizingRef.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            resizingRef.current = false;
          }}
        />
        <section className="content" id="main-content" tabIndex={-1} aria-label="Current screen">
          {children}
        </section>
      </main>
    </div>
  );
}
