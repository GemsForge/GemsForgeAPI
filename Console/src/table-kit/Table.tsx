import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { TableContext } from "./context";
import type {
  TableActionsProps,
  TableContextValue,
  TableHeaderProps,
  TableNewRecordOption,
  TableQueryControlsProps,
  TableRootProps,
  TableSelectionProps,
} from "./types";
import type { TableQueryState } from "./query";
import { useTableContext } from "./context";
import { useTableSelection, type TableSelectionScope } from "./selection";
import { TablePropertyControls } from "./PropertyControls";

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
  selection: selectionConfig,
}: TableRootProps<Row>) {
  const [uncontrolledViewId, setUncontrolledViewId] = useState(defaultViewId ?? views[0]?.id);
  const [uncontrolledPagination, setUncontrolledPagination] = useState(defaultPagination);
  const viewId = controlledViewId ?? uncontrolledViewId;
  const effectivePagination = pagination;
  const isSelectable = selectionConfig?.isSelectable;
  const isSelectableId = selectionConfig?.isSelectableId;
  const configuredMatchingIds = selectionConfig?.matchingIds;
  const currentPageSelectableIds = useMemo(
    () =>
      rows.reduce<string[]>((ids, row, index) => {
        if (isSelectable?.(row, index) ?? true) ids.push(rowKey(row, index));
        return ids;
      }, []),
    [isSelectable, rowKey, rows],
  );
  const allMatchingIds = useMemo(
    () => (configuredMatchingIds ?? currentPageSelectableIds).filter((id) => isSelectableId?.(id) ?? true),
    [configuredMatchingIds, currentPageSelectableIds, isSelectableId],
  );
  const selectionState = useTableSelection({
    defaultSelectedIds: selectionConfig?.defaultSelectedIds,
    selectedIds: selectionConfig?.selectedIds,
    onSelectionChange: selectionConfig?.onSelectionChange,
  });

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
  const selectAll = useCallback(
    (scope: TableSelectionScope) =>
      selectionState.selectAll(scope === "all-matching" ? allMatchingIds : currentPageSelectableIds),
    [allMatchingIds, currentPageSelectableIds, selectionState],
  );
  const toggleAll = useCallback(
    (scope: TableSelectionScope) =>
      selectionState.toggleAll(scope === "all-matching" ? allMatchingIds : currentPageSelectableIds),
    [allMatchingIds, currentPageSelectableIds, selectionState],
  );
  const selection = useMemo(
    () => ({
      enabled: selectionConfig !== undefined,
      selectedIds: selectionState.selectedIds,
      currentPageIds: currentPageSelectableIds,
      allMatchingIds,
      isSelected: selectionState.isSelected,
      toggle: selectionState.toggle,
      add: selectionState.add,
      selectAll,
      toggleAll,
      clear: selectionState.clear,
      getSummary: (scope: TableSelectionScope) =>
        selectionState.getSummary(scope === "all-matching" ? allMatchingIds : currentPageSelectableIds),
    }),
    [allMatchingIds, currentPageSelectableIds, selectAll, selectionConfig, selectionState, toggleAll],
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
      selection,
    }),
    [
      caption,
      columns,
      effectivePagination,
      rowKey,
      rows,
      setPagination,
      setViewId,
      selection,
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

/**
 * Render the shared page-selection control. The optional matching scope is
 * shown only when the adapter supplies IDs beyond the current page.
 */
function Selection({
  label = "Select all",
  clearLabel = "Clear selection",
  allMatchingLabel = "Select all matching",
}: TableSelectionProps) {
  const { selection } = useTableContext();
  const checkboxRef = useRef<HTMLInputElement>(null);
  const currentPage = selection.getSummary("current-page");
  const allMatching = selection.getSummary("all-matching");
  const hasAdditionalMatchingRecords = selection.allMatchingIds.length > selection.currentPageIds.length;

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = currentPage.indeterminate;
  }, [currentPage.indeterminate]);

  return (
    <div className="table-kit-selection" role="group" aria-label="Selection controls">
      <label>
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={currentPage.allSelected}
          disabled={currentPage.totalCount === 0}
          aria-label={label}
          aria-checked={currentPage.indeterminate ? "mixed" : currentPage.allSelected}
          onChange={() => selection.toggleAll("current-page")}
        />
        <span>{currentPage.selectedCount > 0 ? `${currentPage.selectedCount} selected` : label}</span>
      </label>
      {hasAdditionalMatchingRecords && (
        <button type="button" disabled={allMatching.allSelected} onClick={() => selection.selectAll("all-matching")}>
          {allMatching.allSelected ? `All ${allMatching.totalCount} matching selected` : allMatchingLabel}
        </button>
      )}
      {allMatching.selectedCount > 0 && (
        <button type="button" onClick={selection.clear}>
          {clearLabel}
        </button>
      )}
      <output aria-live="polite">{allMatching.selectedCount} selected</output>
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
  newRecordOptions = [],
  onImportFile,
  onPasteCsv,
  onPasteJson,
  newLabel = "New",
  newOptionsLabel,
  importLabel = "Import",
  disabled = false,
  pending = false,
}: TableActionsProps) {
  const isDisabled = disabled || pending;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasNewRecordMenu = newRecordOptions.length > 0;
  const hasImportMenu = Boolean(onImportFile || onPasteCsv || onPasteJson);
  const hasMenu = hasNewRecordMenu || hasImportMenu;
  const menuLabel = newOptionsLabel ?? (hasNewRecordMenu ? "New record options" : "Import options");
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (menuOpen) {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    } else {
      menuTriggerRef.current?.focus();
    }
  }, [menuOpen]);

  const activateMenuItem = async (action: TableNewRecordOption["onSelect"]) => {
    closeMenu();
    await action();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])].filter(
      (item) => !item.disabled,
    );
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[nextIndex]?.focus();
    }
  };

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
      {hasMenu && (
        <div className="table-kit-import-menu">
          <button
            ref={menuTriggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={menuLabel}
            onClick={() => setMenuOpen((open) => !open)}
            disabled={isDisabled}
          >
            {menuLabel}
          </button>
          {menuOpen && (
            <div ref={menuRef} role="menu" tabIndex={-1} onKeyDown={handleMenuKeyDown} aria-label={menuLabel}>
              {newRecordOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  onClick={() => void activateMenuItem(option.onSelect)}
                >
                  <span>{option.label}</span>
                  {option.description && <small>{option.description}</small>}
                </button>
              ))}
              {onImportFile && (
                <button type="button" role="menuitem" onClick={() => void activateMenuItem(onImportFile)}>
                  Import file
                </button>
              )}
              {onPasteCsv && (
                <button type="button" role="menuitem" onClick={() => void activateMenuItem(onPasteCsv)}>
                  Paste CSV
                </button>
              )}
              {onPasteJson && (
                <button type="button" role="menuitem" onClick={() => void activateMenuItem(onPasteJson)}>
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
  Selection,
  QueryControls,
  Actions,
  PropertyControls: TablePropertyControls,
  Content,
  Pagination,
};
