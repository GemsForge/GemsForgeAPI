import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";

interface GemLifeShellProps {
  children: ReactNode;
  sidebar: ReactNode;
}

interface GemLifeShellContextValue {
  setUtilityOpen: (open: boolean) => void;
}

const GemLifeShellContext = createContext<GemLifeShellContextValue>({
  setUtilityOpen: () => undefined,
});

/** Allow collection-owned utilities to collapse and restore the navigation pane. */
export function useGemLifeShell() {
  return useContext(GemLifeShellContext);
}

const COLLAPSED_SIDEBAR_WIDTH = 68;
const EXPANDED_SIDEBAR_WIDTH = 288;
const SIDEBAR_LABEL_THRESHOLD = 160;
const MAX_SIDEBAR_WIDTH = 360;
const MIN_CONTENT_WIDTH = 420;

/** Shared application frame for the Gem Life interface. */
export function GemLifeShell({ children, sidebar }: GemLifeShellProps) {
  const { signOut } = useAuth();
  const workspaceRef = useRef<HTMLElement>(null);
  const resizingRef = useRef(false);
  const manuallyResizedRef = useRef(false);
  const utilityPreviousWidthRef = useRef<number | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= 900 ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_WIDTH,
  );

  const resizeSidebar = (width: number) => {
    const availableWidth = workspaceRef.current?.clientWidth ?? MAX_SIDEBAR_WIDTH + MIN_CONTENT_WIDTH;
    const responsiveMaximum = Math.min(MAX_SIDEBAR_WIDTH, availableWidth - MIN_CONTENT_WIDTH);
    setSidebarWidth(
      Math.min(Math.max(COLLAPSED_SIDEBAR_WIDTH, responsiveMaximum), Math.max(COLLAPSED_SIDEBAR_WIDTH, width)),
    );
  };

  useEffect(() => {
    const handleWindowResize = () => {
      const availableWidth = workspaceRef.current?.clientWidth ?? MAX_SIDEBAR_WIDTH + MIN_CONTENT_WIDTH;
      const responsiveMaximum = Math.min(MAX_SIDEBAR_WIDTH, availableWidth - MIN_CONTENT_WIDTH);
      const maximum = Math.max(COLLAPSED_SIDEBAR_WIDTH, responsiveMaximum);
      const defaultWidth = window.innerWidth <= 900 ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_WIDTH;

      setSidebarWidth((currentWidth) => Math.min(maximum, manuallyResizedRef.current ? currentWidth : defaultWidth));
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
    if (event.key === "Home") resizeSidebar(COLLAPSED_SIDEBAR_WIDTH);
    else if (event.key === "End") resizeSidebar(MAX_SIDEBAR_WIDTH);
    else resizeSidebar(sidebarWidth + (event.key === "ArrowRight" ? 16 : -16));
  };

  const setUtilityOpen = useCallback(
    (open: boolean) => {
      if (open) {
        if (sidebarWidth > COLLAPSED_SIDEBAR_WIDTH && utilityPreviousWidthRef.current === null) {
          utilityPreviousWidthRef.current = sidebarWidth;
        }
        setSidebarWidth(COLLAPSED_SIDEBAR_WIDTH);
        return;
      }
      const previousWidth = utilityPreviousWidthRef.current;
      utilityPreviousWidthRef.current = null;
      if (previousWidth !== null) setSidebarWidth(previousWidth);
    },
    [sidebarWidth],
  );

  const shellContext = useMemo(() => ({ setUtilityOpen }), [setUtilityOpen]);

  return (
    <GemLifeShellContext.Provider value={shellContext}>
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
          data-sidebar-collapsed={sidebarWidth < SIDEBAR_LABEL_THRESHOLD}
          style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
        >
          {sidebar}
          <div
            className="sidebar-resizer"
            role="separator"
            aria-label="Resize navigation pane"
            aria-orientation="vertical"
            aria-valuemin={COLLAPSED_SIDEBAR_WIDTH}
            aria-valuemax={MAX_SIDEBAR_WIDTH}
            aria-valuenow={sidebarWidth}
            tabIndex={0}
            onKeyDown={handleResizeKey}
            onDoubleClick={() => {
              manuallyResizedRef.current = true;
              resizeSidebar(sidebarWidth < SIDEBAR_LABEL_THRESHOLD ? EXPANDED_SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH);
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
    </GemLifeShellContext.Provider>
  );
}
