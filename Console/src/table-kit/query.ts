export type SortDirection = "ascending" | "descending";

export interface TableQueryState {
  search: string;
  filters: Readonly<Record<string, string>>;
  sort: ReadonlyArray<{ columnId: string; direction: SortDirection }>;
  pageIndex: number;
  pageSize: number;
}

export interface TableQueryResult<Row> {
  rows: readonly Row[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

export interface TableQueryAdapter<Row> {
  execute: (query: TableQueryState, signal?: AbortSignal) => Promise<TableQueryResult<Row>>;
}

export interface ClientQueryOptions<Row> {
  rows: readonly Row[];
  searchText: (row: Row) => string;
  filterValue?: (row: Row, columnId: string) => string | undefined;
  compare?: (left: Row, right: Row, columnId: string) => number;
}

export const defaultTableQueryState: TableQueryState = {
  search: "",
  filters: {},
  sort: [],
  pageIndex: 0,
  pageSize: 25,
};

export function normalizeTableQueryState(state: Partial<TableQueryState> = {}): TableQueryState {
  return {
    search: state.search?.trim() ?? "",
    filters: state.filters ?? {},
    sort: state.sort ?? [],
    pageIndex: Math.max(0, state.pageIndex ?? 0),
    pageSize: Math.max(1, state.pageSize ?? defaultTableQueryState.pageSize),
  };
}

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
