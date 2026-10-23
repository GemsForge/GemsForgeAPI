import { useCallback, useMemo, useState } from "react";

/** The record scope affected by a bulk-selection action. */
export type TableSelectionScope = "current-page" | "all-matching";

/** Derived selection state for a visible or filtered record set. */
export interface TableSelectionSummary<RowId extends string = string> {
  ids: readonly RowId[];
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  indeterminate: boolean;
}

/** Controlled and uncontrolled inputs for the reusable selection state machine. */
export interface UseTableSelectionOptions<RowId extends string = string> {
  defaultSelectedIds?: readonly RowId[];
  selectedIds?: ReadonlySet<RowId>;
  onSelectionChange?: (selectedIds: ReadonlySet<RowId>) => void;
}

export interface TableSelection<RowId extends string = string> {
  selectedIds: ReadonlySet<RowId>;
  isSelected: (id: RowId) => boolean;
  replace: (ids: readonly RowId[]) => void;
  toggle: (id: RowId) => void;
  add: (ids: readonly RowId[]) => void;
  selectAll: (ids: readonly RowId[]) => void;
  toggleAll: (ids: readonly RowId[]) => void;
  clear: () => void;
  getSummary: (ids: readonly RowId[]) => TableSelectionSummary<RowId>;
}

/**
 * Manage selection without coupling it to a domain record, query transport, or
 * persistence layer. Bulk operations add or remove only the supplied IDs so
 * selections from other pages survive pagination and view changes.
 */
export function useTableSelection<RowId extends string = string>({
  defaultSelectedIds = [],
  selectedIds: controlledSelectedIds,
  onSelectionChange,
}: UseTableSelectionOptions<RowId> = {}): TableSelection<RowId> {
  const [uncontrolledSelectedIds, setUncontrolledSelectedIds] = useState<ReadonlySet<RowId>>(
    () => new Set(defaultSelectedIds),
  );
  const selectedIds = controlledSelectedIds ?? uncontrolledSelectedIds;
  const update = useCallback(
    (next: ReadonlySet<RowId>) => {
      if (controlledSelectedIds === undefined) setUncontrolledSelectedIds(next);
      onSelectionChange?.(next);
    },
    [controlledSelectedIds, onSelectionChange],
  );
  const toggle = useCallback(
    (id: RowId) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      update(next);
    },
    [selectedIds, update],
  );
  /** Replace a prior single-record choice atomically so a new click cannot retain it. */
  const replace = useCallback((ids: readonly RowId[]) => update(new Set(ids)), [update]);
  const add = useCallback(
    (ids: readonly RowId[]) => {
      const next = new Set(selectedIds);
      ids.forEach((id) => next.add(id));
      update(next);
    },
    [selectedIds, update],
  );
  const selectAll = useCallback(
    (ids: readonly RowId[]) => {
      const next = new Set(selectedIds);
      ids.forEach((id) => next.add(id));
      update(next);
    },
    [selectedIds, update],
  );
  const toggleAll = useCallback(
    (ids: readonly RowId[]) => {
      const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
      const next = new Set(selectedIds);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      update(next);
    },
    [selectedIds, update],
  );
  const clear = useCallback(() => update(new Set()), [update]);
  const getSummary = useCallback(
    (ids: readonly RowId[]): TableSelectionSummary<RowId> => {
      const selectedCount = ids.reduce((count, id) => count + (selectedIds.has(id) ? 1 : 0), 0);
      return {
        ids,
        selectedCount,
        totalCount: ids.length,
        allSelected: ids.length > 0 && selectedCount === ids.length,
        indeterminate: selectedCount > 0 && selectedCount < ids.length,
      };
    },
    [selectedIds],
  );
  return useMemo(
    () => ({
      selectedIds,
      isSelected: (id: RowId) => selectedIds.has(id),
      replace,
      toggle,
      add,
      selectAll,
      toggleAll,
      clear,
      getSummary,
    }),
    [add, clear, getSummary, replace, selectAll, selectedIds, toggle, toggleAll],
  );
}

/** Shared selection operations exposed through one Table.Root context. */
export interface TableSelectionContext<RowId extends string = string> {
  /** Whether the root explicitly opted its renderers into shared selection. */
  enabled: boolean;
  selectedIds: ReadonlySet<RowId>;
  currentPageIds: readonly RowId[];
  allMatchingIds: readonly RowId[];
  isSelected: (id: RowId) => boolean;
  toggle: (id: RowId) => void;
  replace: (ids: readonly RowId[]) => void;
  add: (ids: readonly RowId[]) => void;
  selectAll: (scope: TableSelectionScope) => void;
  toggleAll: (scope: TableSelectionScope) => void;
  clear: () => void;
  getSummary: (scope: TableSelectionScope) => TableSelectionSummary<RowId>;
}
