import { useMemo, useState } from "react";

export interface TableSelection<RowId extends string = string> {
  selectedIds: ReadonlySet<RowId>;
  isSelected: (id: RowId) => boolean;
  toggle: (id: RowId) => void;
  selectAll: (ids: readonly RowId[]) => void;
  clear: () => void;
}

export function useTableSelection<RowId extends string = string>(): TableSelection<RowId> {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<RowId>>(() => new Set());
  return useMemo(
    () => ({
      selectedIds,
      isSelected: (id: RowId) => selectedIds.has(id),
      toggle: (id: RowId) =>
        setSelectedIds((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      selectAll: (ids: readonly RowId[]) => setSelectedIds(new Set(ids)),
      clear: () => setSelectedIds(new Set()),
    }),
    [selectedIds],
  );
}
