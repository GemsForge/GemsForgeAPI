export type SortDirection = "ascending" | "descending";

/** Normalized, serializable query state shared by every table presentation. */
export interface TableQueryState {
  search: string;
  filters: Readonly<Record<string, string>>;
  sort: ReadonlyArray<{ columnId: string; direction: SortDirection }>;
  pageIndex: number;
  pageSize: number;
}

/** A page of results after query processing. */
export interface TableQueryResult<Row> {
  rows: readonly Row[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

/** Optional server-side execution boundary; transport and caching stay external. */
export interface TableQueryAdapter<Row> {
  execute: (query: TableQueryState, signal?: AbortSignal) => Promise<TableQueryResult<Row>>;
}

export interface UseTableQueryStateOptions {
  viewId?: string;
  views?: ReadonlyArray<{ id: string; configuration?: Partial<TableQueryState> }>;
  defaultState?: Partial<TableQueryState>;
  state?: TableQueryState;
  onStateChange?: (state: TableQueryState) => void;
  /** Initial query configurations keyed by named view ID. */
  viewConfigurations?: Readonly<Record<string, Partial<TableQueryState>>>;
}

export interface UseTableQueryStateResult {
  state: TableQueryState;
  setState: (state: TableQueryState | ((current: TableQueryState) => TableQueryState)) => void;
  reset: () => void;
}

/** Callbacks required to derive client-side results without domain coupling. */
export interface ClientQueryOptions<Row> {
  rows: readonly Row[];
  searchText: (row: Row) => string;
  filterValue?: (row: Row, columnId: string) => string | undefined;
  compare?: (left: Row, right: Row, columnId: string) => number;
}

/** Defaults used when a caller provides a partial query state. */
export const defaultTableQueryState: TableQueryState = {
  search: "",
  filters: {},
  sort: [],
  pageIndex: 0,
  pageSize: 25,
};

/** Normalize query input without mutating caller-owned state. */
export function normalizeTableQueryState(state: Partial<TableQueryState> = {}): TableQueryState {
  return {
    search: state.search?.trim() ?? "",
    filters: state.filters ?? {},
    sort: state.sort ?? [],
    pageIndex: Math.max(0, state.pageIndex ?? 0),
    pageSize: Math.max(1, state.pageSize ?? defaultTableQueryState.pageSize),
  };
}

/** Manage query ownership and preserve independent state for each view ID. */
export function useTableQueryState({
  viewId,
  views,
  defaultState,
  state: controlledState,
  onStateChange,
  viewConfigurations = {},
}: UseTableQueryStateOptions = {}): UseTableQueryStateResult {
  const configuredViews = useMemo(
    () => ({
      ...Object.fromEntries(
        (views ?? []).filter((view) => view.configuration).map((view) => [view.id, view.configuration]),
      ),
      ...viewConfigurations,
    }),
    [viewConfigurations, views],
  );
  const initialState = normalizeTableQueryState({ ...defaultState, ...(viewId ? configuredViews[viewId] : undefined) });
  const [uncontrolledState, setUncontrolledState] = useState(initialState);
  const viewStates = useRef(new Map<string, TableQueryState>());
  const previousViewId = useRef(viewId);
  const state = controlledState ?? uncontrolledState;

  useEffect(() => {
    if (previousViewId.current === viewId) return;
    if (previousViewId.current) viewStates.current.set(previousViewId.current, state);
    previousViewId.current = viewId;
    const restored = viewId ? viewStates.current.get(viewId) : undefined;
    const configured = viewId ? configuredViews[viewId] : undefined;
    if (controlledState === undefined) {
      setUncontrolledState(
        restored ?? (configured ? normalizeTableQueryState({ ...initialState, ...configured }) : initialState),
      );
    }
  }, [controlledState, configuredViews, initialState, state, viewId]);

  const setState = useCallback(
    (next: TableQueryState | ((current: TableQueryState) => TableQueryState)) => {
      const resolved = normalizeTableQueryState(typeof next === "function" ? next(state) : next);
      if (viewId) viewStates.current.set(viewId, resolved);
      if (controlledState === undefined) setUncontrolledState(resolved);
      onStateChange?.(resolved);
    },
    [controlledState, onStateChange, state, viewId],
  );
  const reset = useCallback(() => setState(initialState), [initialState, setState]);

  return { state, setState, reset };
}

/** Derive filtered, sorted, paginated results for a client-owned data set. */
export function deriveClientQuery<Row>(
  query: TableQueryState,
  { rows, searchText, filterValue, compare }: ClientQueryOptions<Row>,
): TableQueryResult<Row> {
  const normalized = normalizeTableQueryState(query);
  const search = normalized.search.toLowerCase();
  let matching = rows.filter((row) => {
    if (search && !searchText(row).toLowerCase().includes(search)) return false;
    return Object.entries(normalized.filters).every(
      ([columnId, expected]) => !expected || filterValue?.(row, columnId) === expected,
    );
  });

  if (compare && normalized.sort.length) {
    matching = [...matching].sort((left, right) => {
      for (const rule of normalized.sort) {
        const result = compare(left, right, rule.columnId);
        if (result !== 0) return rule.direction === "ascending" ? result : -result;
      }
      return 0;
    });
  }

  const start = normalized.pageIndex * normalized.pageSize;
  return {
    rows: matching.slice(start, start + normalized.pageSize),
    total: matching.length,
    pageIndex: normalized.pageIndex,
    pageSize: normalized.pageSize,
  };
}
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
