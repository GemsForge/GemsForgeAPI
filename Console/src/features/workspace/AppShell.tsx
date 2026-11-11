import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { WireframeLeftPane } from "./WireframeLeftPane";
import { useWireframeNavigation } from "./WireframeAppHeader";

type PaneIcon = ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" | "false" }>;

/** What the active page tells the persistent navigation pane about itself. */
export interface AppShellPane {
  recordCount: number;
  activeCollection?: string;
  activeCollectionTitle?: string;
  activeCollectionIcon?: PaneIcon;
}

/** Layout modifiers the active page applies to the shared frame grid. */
export interface AppShellFrame {
  inspector?: "closed" | "open" | "expanded";
  inspectorWidth?: number;
  schemaTable?: string;
}

interface AppShellState {
  pane: AppShellPane;
  frame: AppShellFrame;
}

const defaultState: AppShellState = { pane: { recordCount: 0, activeCollection: "" }, frame: {} };

const AppShellContext = createContext<((state: AppShellState) => void) | null>(null);

const sameState = (left: AppShellState, right: AppShellState) =>
  left.pane.recordCount === right.pane.recordCount &&
  left.pane.activeCollection === right.pane.activeCollection &&
  left.pane.activeCollectionTitle === right.pane.activeCollectionTitle &&
  left.pane.activeCollectionIcon === right.pane.activeCollectionIcon &&
  left.frame.inspector === right.frame.inspector &&
  left.frame.inspectorWidth === right.frame.inspectorWidth &&
  left.frame.schemaTable === right.frame.schemaTable;

/**
 * Registers the active page's navigation context and frame layout with the
 * persistent app shell. Pages render only their content; the shell owns the
 * navigation pane, its collapse state, and the compact-width drawer.
 */
export function useAppShell(pane: AppShellPane, frame: AppShellFrame = {}) {
  const publish = useContext(AppShellContext);
  const { recordCount, activeCollection = "", activeCollectionTitle, activeCollectionIcon } = pane;
  const { inspector = "closed", inspectorWidth, schemaTable } = frame;
  useLayoutEffect(() => {
    publish?.({
      pane: { recordCount, activeCollection, activeCollectionTitle, activeCollectionIcon },
      frame: { inspector, inspectorWidth, schemaTable },
    });
  }, [
    publish,
    recordCount,
    activeCollection,
    activeCollectionTitle,
    activeCollectionIcon,
    inspector,
    inspectorWidth,
    schemaTable,
  ]);
}

const inspectorClassName = {
  closed: "inspector-closed",
  open: "has-inspector",
  expanded: "has-inspector is-expanded",
} as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigation = useWireframeNavigation();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [state, setState] = useState(defaultState);
  const publish = useMemo(
    () => (next: AppShellState) => setState((current) => (sameState(current, next) ? current : next)),
    [],
  );
  const mobileOpen = navigation?.open ?? false;
  const setNavigationOpen = navigation?.setOpen;

  useEffect(() => {
    setNavigationOpen?.(false);
  }, [pathname, setNavigationOpen]);

  const { pane, frame } = state;
  const Icon = pane.activeCollectionIcon;
  const style =
    frame.inspectorWidth === undefined
      ? undefined
      : ({ "--inspector-width": `${frame.inspectorWidth}px` } as CSSProperties);

  return (
    <AppShellContext.Provider value={publish}>
      <section
        className={`wireframe-demo wireframe-standalone wireframe-app-shell ${inspectorClassName[frame.inspector ?? "closed"]}`}
        style={style}
        data-schema-table={frame.schemaTable}
      >
        <div id="wireframe-navigation" className={mobileOpen ? "wireframe-mobile-nav is-open" : "wireframe-mobile-nav"}>
          {mobileOpen ? (
            <button
              type="button"
              className="wireframe-nav-backdrop"
              aria-label="Close navigation"
              onClick={() => navigation?.close()}
            />
          ) : null}
          <WireframeLeftPane
            recordCount={pane.recordCount}
            activeCollection={pane.activeCollection}
            activeCollectionTitle={pane.activeCollectionTitle}
            activeCollectionIcon={Icon ? <Icon size={16} aria-hidden="true" /> : undefined}
            collapsed={mobileOpen ? false : collapsed}
            onToggleCollapsed={() => setCollapsed((value) => !value)}
            onCloseNavigation={navigation ? navigation.close : undefined}
            mobileDrawerOpen={mobileOpen}
          />
        </div>
        {children}
      </section>
    </AppShellContext.Provider>
  );
}
