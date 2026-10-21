import { useCallback, useMemo, useState, type ReactNode } from "react";
import { TableContext } from "./context";
import type { TableContextValue, TableRootProps } from "./types";
import { useTableContext } from "./context";

function Root<Row>({
  rows,
  columns,
  rowKey,
  children,
  caption = "Data table",
  views = [],
  defaultViewId,
  viewId: controlledViewId,
  onViewChange,
  pagination,
  defaultPagination = { pageIndex: 0, pageSize: 25 },
  onPaginationChange,
}: TableRootProps<Row>) {
  const [uncontrolledViewId, setUncontrolledViewId] = useState(defaultViewId ?? views[0]?.id);
  const [uncontrolledPagination, setUncontrolledPagination] = useState(defaultPagination);
  const viewId = controlledViewId ?? uncontrolledViewId;
  const effectivePagination = pagination;

  const setViewId = useCallback(
    (next: string) => {
      if (controlledViewId === undefined) setUncontrolledViewId(next);
      onViewChange?.(next);
    },
    [controlledViewId, onViewChange],
  );
  const setPagination = useCallback(
    (next: typeof defaultPagination) => {
      if (pagination === undefined) setUncontrolledPagination(next);
      onPaginationChange?.(next);
    },
    [onPaginationChange, pagination],
  );
  const value = useMemo(
    () => ({
      rows,
      columns,
      rowKey,
      caption,
      views,
      viewId,
      setViewId,
      pagination: effectivePagination ?? { ...uncontrolledPagination, total: rows.length },
      setPagination,
    }),
    [
      caption,
      columns,
      effectivePagination,
      rowKey,
      rows,
      setPagination,
      setViewId,
      uncontrolledPagination,
      viewId,
      views,
    ],
  );
  return (
    <TableContext.Provider value={value as unknown as TableContextValue<unknown>}>{children}</TableContext.Provider>
  );
}

function Header({ children }: { children?: ReactNode }) {
  return <header className="table-kit-header">{children}</header>;
}

function Views<Row>() {
  const { views, viewId, setViewId } = useTableContext<Row>();
  if (!views.length) return null;
  return (
    <div className="table-kit-views" role="tablist" aria-label="Table views">
      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          role="tab"
          aria-selected={view.id === viewId}
          onClick={() => setViewId(view.id)}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

function Toolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="table-kit-toolbar" role="toolbar">
      {children}
    </div>
  );
}

function Content<Row>({ children }: { children?: ReactNode }) {
  useTableContext<Row>();
  return (
    <section className="table-kit-content" aria-label="Table content">
      {children}
    </section>
  );
}

function Pagination<Row>({ children }: { children?: ReactNode }) {
  useTableContext<Row>();
  return (
    <nav aria-label="Table pagination" className="table-kit-pagination">
      {children}
    </nav>
  );
}

export const Table = { Root, Header, Views, Toolbar, Content, Pagination };
