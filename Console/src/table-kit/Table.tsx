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
    [caption, columns, effectivePagination, rowKey, rows, setPagination, setViewId, uncontrolledPagination, viewId, views],
  );
  return <TableContext.Provider value={value as unknown as TableContextValue<unknown>}>{children}</TableContext.Provider>;
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
        <button key={view.id} type="button" role="tab" aria-selected={view.id === viewId} onClick={() => setViewId(view.id)}>
          {view.label}
        </button>
      ))}
    </div>
  );
}

function Toolbar({ children }: { children?: ReactNode }) {
  return <div className="table-kit-toolbar" role="toolbar">{children}</div>;
}

function Content<Row>() {
  const { rows, columns, rowKey, caption } = useTableContext<Row>();
  const visibleColumns = columns.filter((column) => column.visible !== false);
  return (
    <div className="table-kit-content" role="region" aria-label={caption} tabIndex={0}>
      <table>
        <caption>{caption}</caption>
        <thead><tr>{visibleColumns.map((column) => <th key={column.id} scope="col">{column.header}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={rowKey(row, index)}>{visibleColumns.map((column) => <td key={column.id}>{column.cell(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Pagination<Row>() {
  const { pagination, setPagination } = useTableContext<Row>();
  if (!pagination) return null;
  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  return (
    <nav aria-label="Table pagination" className="table-kit-pagination">
      <button type="button" disabled={pagination.pageIndex === 0} onClick={() => setPagination({ ...pagination, pageIndex: pagination.pageIndex - 1 })}>Previous</button>
      <span>Page {pagination.pageIndex + 1} of {pageCount}</span>
      <button type="button" disabled={pagination.pageIndex >= pageCount - 1} onClick={() => setPagination({ ...pagination, pageIndex: pagination.pageIndex + 1 })}>Next</button>
    </nav>
  );
}

export const Table = { Root, Header, Views, Toolbar, Content, Pagination };
