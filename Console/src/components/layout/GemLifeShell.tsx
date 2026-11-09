import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent, ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { useLocation } from "react-router-dom";
import { usePagesQuery } from "../../data/workflowQueries";
import { inspectionBypassEnabled } from "../../auth/session";
import { workspacePreviewPages } from "../../features/workspace/workspacePreviewData";
import { gemBreakpoints, gemLayout } from "@gemsforge/ui";

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

const COLLAPSED_SIDEBAR_WIDTH = gemLayout.appSidebarCollapsed;
const EXPANDED_SIDEBAR_WIDTH = gemLayout.appSidebarExpanded;
const SIDEBAR_LABEL_THRESHOLD = gemLayout.appSidebarLabelThreshold;
const MAX_SIDEBAR_WIDTH = gemLayout.appSidebarMaximum;
const MIN_CONTENT_WIDTH = gemLayout.appContentMinimum;

/** Shared application frame for the Gem Life interface. */
export function GemLifeShell({ children, sidebar }: GemLifeShellProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const isWorkspace = location.pathname === "/workspace";
  const pagesQuery = usePagesQuery({ kind: "roots" }, isWorkspace && !inspectionBypassEnabled);
  const selectedPageID = Number(new URLSearchParams(location.search).get("page"));
  const pages = inspectionBypassEnabled
    ? pagesQuery.data?.length
      ? pagesQuery.data
      : workspacePreviewPages
    : pagesQuery.data;
  const activePage = pages?.find((page) => page.id === selectedPageID) ?? pages?.[0];
  const workspaceRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const manuallyResizedRef = useRef(false);
  const utilityPreviousWidthRef = useRef<number | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() =>
    typeof window !== "undefined" && window.innerWidth <= gemBreakpoints.tablet
      ? COLLAPSED_SIDEBAR_WIDTH
      : EXPANDED_SIDEBAR_WIDTH,
  );
  const [searchValue, setSearchValue] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchMatches = (pages ?? []).filter((page) =>
    page.title.toLocaleLowerCase().includes(searchValue.trim().toLocaleLowerCase()),
  );

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

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
      const defaultWidth =
        window.innerWidth <= gemBreakpoints.tablet ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_WIDTH;

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

  const handleResizeKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
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
      <div
        ref={workspaceRef}
        className="app-shell"
        data-mobile-nav-open={mobileNavOpen}
        data-workspace-route={isWorkspace ? "true" : "false"}
        data-sidebar-collapsed={sidebarWidth < SIDEBAR_LABEL_THRESHOLD}
        style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
      >
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
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
        <div className="app-main-column">
          <header className="topbar">
            <div className="workspace-breadcrumbs">
              <button
                className="workspace-mobile-menu"
                type="button"
                aria-label="Toggle navigation"
                aria-expanded={mobileNavOpen}
                onClick={() => setMobileNavOpen((open) => !open)}
              >
                ☰
              </button>
              <button type="button" aria-label="Previous page" onClick={() => window.history.back()}>
                ←
              </button>
              <button type="button" aria-label="Next page" onClick={() => window.history.forward()}>
                →
              </button>
              <span className="breadcrumb-library">♧&nbsp; Library</span>
              <span aria-hidden="true">›</span>
              <span>{activePage?.title ?? "Workspace"}</span>
            </div>
            <label className="workspace-search">
              <span aria-hidden="true">⌕</span>
              <input
                ref={searchRef}
                aria-label="Search Gem Life"
                placeholder="Search GEM LIFE"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
              <kbd>⌘K</kbd>
              {searchValue.trim() ? (
                <nav className="workspace-search-results" aria-label="Matching pages">
                  {searchMatches.length ? (
                    searchMatches.map((page) => (
                      <a key={page.id} href={`/workspace?page=${page.id}`}>
                        {page.title}
                      </a>
                    ))
                  ) : (
                    <span>No matching pages</span>
                  )}
                </nav>
              ) : null}
            </label>
            {!isWorkspace ? <div className="connection-pill">Private workspace</div> : null}
            <button
              type="button"
              className="secondary-button shell-sign-out"
              aria-label="Sign out"
              onClick={() => void signOut()}
            >
              ⇥
            </button>
          </header>
          <main
            className="workspace"
            data-sidebar-collapsed={sidebarWidth < SIDEBAR_LABEL_THRESHOLD}
            style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
          >
            <section className="content" id="main-content" tabIndex={-1} aria-label="Current screen">
              {children}
            </section>
          </main>
        </div>
      </div>
    </GemLifeShellContext.Provider>
  );
}
