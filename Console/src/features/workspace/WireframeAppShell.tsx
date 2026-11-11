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
export interface WireframeShellPane {
  recordCount: number;
  activeCollection?: string;
  activeCollectionTitle?: string;
  activeCollectionIcon?: PaneIcon;
}

/** Layout modifiers the active page applies to the shared frame grid. */
export interface WireframeShellFrame {
  inspector?: "closed" | "open" | "expanded";
  inspectorWidth?: number;
  schemaTable?: string;
}

interface WireframeShellState {
  pane: WireframeShellPane;
  frame: WireframeShellFrame;
}

const defaultState: WireframeShellState = { pane: { recordCount: 0, activeCollection: "" }, frame: {} };

const WireframeShellContext = createContext<((state: WireframeShellState) => void) | null>(null);

const sameState = (left: WireframeShellState, right: WireframeShellState) =>
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
export function useWireframeShell(pane: WireframeShellPane, frame: WireframeShellFrame = {}) {
  const publish = useContext(WireframeShellContext);
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

export function WireframeAppShell({ children }: { children: ReactNode }) {
  const navigation = useWireframeNavigation();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [state, setState] = useState(defaultState);
  const publish = useMemo(
    () => (next: WireframeShellState) => setState((current) => (sameState(current, next) ? current : next)),
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
    <WireframeShellContext.Provider value={publish}>
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
    </WireframeShellContext.Provider>
  );
}
