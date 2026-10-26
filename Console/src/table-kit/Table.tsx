import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button, Menu, ToggleGroup, Tooltip, type TamaguiElement } from "tamagui";
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
import { NewRecordUtility } from "./NewRecordUtility";
import { GemButton } from "../components/ui";

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

/** Render the single-selection xs Tamagui ToggleGroup that scopes each view renderer. */
function Views<Row>() {
  const { views, viewId, setViewId } = useTableContext<Row>();
  if (!views.length) return null;
  return (
    <ToggleGroup
      type="single"
      value={viewId}
      onValueChange={(next: string | string[]) => {
        if (typeof next === "string" && next) setViewId(next);
      }}
      orientation="horizontal"
      disableDeactivation
      className="table-kit-views"
      aria-label="Table views"
    >
      {views.map((view) => (
        <ToggleGroup.Item key={view.id} value={view.id} size="xs" color="$gemInk" aria-label={view.label}>
          <Tooltip placement="top" delay={300}>
            <Tooltip.Trigger asChild>
              <span className="table-kit-view-icon" aria-hidden="true">
                {view.icon}
              </span>
            </Tooltip.Trigger>
            <Tooltip.Content className="table-kit-tooltip">
              <Tooltip.Arrow />
              <span>{view.label}</span>
            </Tooltip.Content>
          </Tooltip>
          <span className="sr-only">{view.label}</span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup>
  );
}

function Toolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="table-kit-toolbar" role="toolbar">
      {children}
    </div>
  );
}

/** Render the shared page-selection control for the current page. */
function Selection({ label = "Select all", clearLabel = "Clear selection" }: TableSelectionProps) {
  const { selection } = useTableContext();
  const checkboxRef = useRef<HTMLInputElement>(null);
  const currentPage = selection.getSummary("current-page");
  const allMatching = selection.getSummary("all-matching");

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = currentPage.indeterminate;
  }, [currentPage.indeterminate]);

  // GemButton uses its shared default size; typography tokens are not valid ButtonSize values.
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
        <span>{allMatching.selectedCount > 0 ? `${allMatching.selectedCount} selected` : label}</span>
      </label>
      {allMatching.selectedCount > 0 && (
        <GemButton type="button" variant="outlined" onPress={selection.clear}>
          {clearLabel}
        </GemButton>
      )}
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

/** Render the compact xs plus utility while preserving consumer-owned create/import actions in one menu. */
function Actions({
  onNew,
  onImport,
  newRecordOptions = [],
  onImportFile,
  onPasteCsv,
  onPasteJson,
  newLabel = "New",
  newOptionsLabel,
  newRecordUtility,
  importLabel = "Import",
  disabled = false,
  pending = false,
}: TableActionsProps) {
  const isDisabled = disabled || pending;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<TamaguiElement>(null);
  const menuContentRef = useRef<TamaguiElement>(null);
  const previousMenuOpen = useRef(menuOpen);
  const hasNewRecordMenu = newRecordOptions.length > 0;
  const hasImportMenu = Boolean(onImportFile || onPasteCsv || onPasteJson);
  const hasMenu = hasNewRecordMenu || hasImportMenu || Boolean(onNew && onImport);
  const menuLabel = newOptionsLabel ?? (onNew || hasNewRecordMenu ? "New record options" : "Import options");
  const menuOptions: TableNewRecordOption[] = [
    ...(onNew ? [{ id: "default-new", label: newLabel, onSelect: onNew }] : []),
    ...newRecordOptions,
    ...(onImport && hasMenu ? [{ id: "default-import", label: importLabel, onSelect: onImport }] : []),
  ];
  useEffect(() => {
    if (previousMenuOpen.current && !menuOpen) menuTriggerRef.current?.focus();
    if (!previousMenuOpen.current && menuOpen) {
      (menuContentRef.current as unknown as HTMLElement | null)
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus();
    }
    previousMenuOpen.current = menuOpen;
  }, [menuOpen]);
  /** Keep controlled-menu keyboard movement predictable when no trigger owns focus. */
  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(
      (menuContentRef.current as unknown as HTMLElement | null)?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ??
        [],
    ).filter((item) => !item.hasAttribute("aria-disabled"));
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (currentIndex + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
    items[nextIndex]?.focus();
  };
  return (
    <div className="table-kit-actions" role="group" aria-busy={pending}>
      {newRecordUtility && (
        <NewRecordUtility {...newRecordUtility} triggerRef={menuTriggerRef} disabled={disabled} pending={pending} />
      )}
      {!newRecordUtility && onNew && !hasMenu && (
        <Tooltip placement="top" delay={300}>
          <Tooltip.Trigger asChild>
            <Button
              type="button"
              size="xs"
              color="$gemInk"
              backgroundColor="$gemPanel"
              borderColor="$gemPanelLight"
              borderWidth={1}
              borderRadius="$gemControl"
              className="compact-icon-button"
              onClick={() => void onNew()}
              disabled={isDisabled}
              aria-busy={pending}
              aria-label={newLabel}
            >
              <span aria-hidden="true">＋</span>
              <span className="sr-only">{newLabel}</span>
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content className="table-kit-tooltip">
            <Tooltip.Arrow />
            <span>{newLabel}</span>
          </Tooltip.Content>
        </Tooltip>
      )}
      {!newRecordUtility && onImport && !hasMenu && (
        <Button
          size="xs"
          color="$gemInk"
          backgroundColor="$gemPanel"
          borderColor="$gemPanelLight"
          borderWidth={1}
          borderRadius="$gemControl"
          type="button"
          onClick={() => void onImport()}
          disabled={isDisabled}
          aria-busy={pending}
        >
          {importLabel}
        </Button>
      )}
      {!newRecordUtility && hasMenu && (
        <Menu open={menuOpen} onOpenChange={setMenuOpen} placement="bottom-end" modal={false}>
          <Tooltip placement="top" delay={300}>
            <Tooltip.Trigger asChild>
              <Button
                ref={menuTriggerRef}
                type="button"
                size="xs"
                color="$gemInk"
                backgroundColor="$gemPanel"
                borderColor="$gemPanelLight"
                borderWidth={1}
                borderRadius="$gemControl"
                aria-label={menuLabel}
                disabled={isDisabled}
                className="compact-icon-button"
                onClick={() => setMenuOpen((current) => !current)}
              >
                <span aria-hidden="true">＋</span>
                <span className="sr-only">{menuLabel}</span>
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content className="table-kit-tooltip">
              <Tooltip.Arrow />
              <span>{menuLabel}</span>
            </Tooltip.Content>
          </Tooltip>
          <Menu.Portal zIndex={20}>
            <Menu.Content
              ref={menuContentRef}
              className="table-kit-menu-content"
              aria-label={menuLabel}
              loop
              onKeyDown={handleMenuKeyDown}
            >
              {menuOptions.map((option) => (
                <Menu.Item key={option.id} onSelect={() => void option.onSelect()} textValue={option.label}>
                  <Menu.ItemTitle>{option.label}</Menu.ItemTitle>
                  {option.description && <Menu.ItemSubtitle>{option.description}</Menu.ItemSubtitle>}
                </Menu.Item>
              ))}
              {onImportFile && (
                <Menu.Item onSelect={() => void onImportFile()} textValue="Import file">
                  <Menu.ItemTitle>Import file</Menu.ItemTitle>
                </Menu.Item>
              )}
              {onPasteCsv && (
                <Menu.Item onSelect={() => void onPasteCsv()} textValue="Paste CSV">
                  <Menu.ItemTitle>Paste CSV</Menu.ItemTitle>
                </Menu.Item>
              )}
              {onPasteJson && (
                <Menu.Item onSelect={() => void onPasteJson()} textValue="Paste JSON">
                  <Menu.ItemTitle>Paste JSON</Menu.ItemTitle>
                </Menu.Item>
              )}
            </Menu.Content>
          </Menu.Portal>
        </Menu>
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
