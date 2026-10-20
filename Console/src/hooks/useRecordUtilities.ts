import { useMemo, useState } from "react";

export type RecordSortDirection = "asc" | "desc";

export function useRecordUtilities<T>(records: readonly T[], searchable: (record: T) => unknown[], sortOptions: Record<string, (a: T, b: T) => number>, defaultSort = "") {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(defaultSort);
  const [direction, setDirection] = useState<RecordSortDirection>("asc");
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const result = records.filter((record) => !term || searchable(record).some((value) => String(value ?? "").toLocaleLowerCase().includes(term)))
      .filter((record) => !filter || searchable(record).some((value) => String(value ?? "") === filter));
    const compare = sortOptions[sort];
    if (!compare) return result;
    return [...result].sort((a, b) => (direction === "asc" ? compare(a, b) : compare(b, a)));
  }, [records, searchable, search, filter, sort, direction, sortOptions]);
  return { records: filtered, search, onSearch: setSearch, sort, onSort: setSort, direction, onDirection: () => setDirection((value) => value === "asc" ? "desc" : "asc"), filter, onFilter: setFilter };
}
