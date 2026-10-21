import { useCallback, useMemo, useState, type ReactNode } from "react";
import { TableContext } from "./context";
import type {
  TableActionsProps,
  TableContextValue,
  TableHeaderProps,
  TableQueryControlsProps,
  TableRootProps,
} from "./types";
import type { TableQueryState } from "./query";
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

function Header({
  children,
  title,
  description,
  metadata,
  collapsibleDescription = false,
}: TableHeaderProps & { children?: ReactNode }) {
  return (
    <header className="table-kit-header">
      {children}
      {title !== undefined && <div className="table-kit-title">{title}</div>}
      {description !== undefined && <Description collapsible={collapsibleDescription}>{description}</Description>}
      {metadata !== undefined && <div className="table-kit-metadata">{metadata}</div>}
    </header>
  );
}

function Description({ children, collapsible = false }: { children?: ReactNode; collapsible?: boolean }) {
  const [open, setOpen] = useState(true);
  if (!collapsible) return <p className="table-kit-description">{children}</p>;
  return (
    <div className="table-kit-description">
      <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {open ? "Hide description" : "Show description"}
      </button>
      {open && <p>{children}</p>}
    </div>
  );
}

function Title({ children }: { children?: ReactNode }) {
  return <h2 className="table-kit-title">{children}</h2>;
}

function Metadata({ children }: { children?: ReactNode }) {
  return <dl className="table-kit-metadata">{children}</dl>;
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
          {view.icon}
          <span>{view.label}</span>
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

function QueryControls({
  state,
  onStateChange,
  filters = [],
  searchLabel = "Search",
  searchPlaceholder = "Search",
  disabled = false,
  pending = false,
}: TableQueryControlsProps) {
  const update = (patch: Partial<TableQueryState>) => onStateChange({ ...state, ...patch, pageIndex: 0 });
  const isDisabled = disabled || pending;
  return (
    <div className="table-kit-query-controls" aria-busy={pending}>
      <label>
        {searchLabel}
        <input
          type="search"
          value={state.search}
          placeholder={searchPlaceholder}
          disabled={isDisabled}
          onChange={(event) => update({ search: event.target.value })}
        />
      </label>
      {filters.map((filter) => (
        <label key={filter.id}>
          {filter.label}
          <select
            value={state.filters[filter.id] ?? ""}
            disabled={isDisabled}
            onChange={(event) => update({ filters: { ...state.filters, [filter.id]: event.target.value } })}
          >
            <option value="">All</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button
        type="button"
        onClick={() => onStateChange({ ...state, search: "", filters: {}, pageIndex: 0 })}
        disabled={isDisabled}
      >
        Reset
      </button>
    </div>
  );
}

function Actions({
  onNew,
  onImport,
  onImportFile,
  onPasteCsv,
  onPasteJson,
  newLabel = "New",
  importLabel = "Import",
  disabled = false,
  pending = false,
}: TableActionsProps) {
  const isDisabled = disabled || pending;
  const [menuOpen, setMenuOpen] = useState(false);
  const hasImportMenu = Boolean(onImportFile || onPasteCsv || onPasteJson);
  return (
    <div className="table-kit-actions" role="group" aria-busy={pending}>
      {onNew && (
        <button type="button" onClick={() => void onNew()} disabled={isDisabled} aria-busy={pending}>
          {newLabel}
        </button>
      )}
      {onImport && (
        <button type="button" onClick={() => void onImport()} disabled={isDisabled} aria-busy={pending}>
          {importLabel}
        </button>
      )}
      {hasImportMenu && (
        <div className="table-kit-import-menu">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            disabled={isDisabled}
          >
            Import options
          </button>
          {menuOpen && (
            <div role="menu">
              {onImportFile && (
                <button type="button" role="menuitem" onClick={() => void onImportFile()}>
                  Import file
                </button>
              )}
              {onPasteCsv && (
                <button type="button" role="menuitem" onClick={() => void onPasteCsv()}>
                  Paste CSV
                </button>
              )}
              {onPasteJson && (
                <button type="button" role="menuitem" onClick={() => void onPasteJson()}>
                  Paste JSON
                </button>
              )}
            </div>
          )}
        </div>
      )}
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

export const Table = {
  Root,
  Header: Object.assign(Header, { Title, Description, Metadata }),
  // Keep the flat exports as additive compatibility aliases.
  Title,
  Description,
  Metadata,
  Views,
  Toolbar,
  QueryControls,
  Actions,
  Content,
  Pagination,
};
