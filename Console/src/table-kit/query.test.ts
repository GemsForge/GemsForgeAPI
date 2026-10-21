import { describe, expect, it } from "vitest";
import { deriveClientQuery, normalizeTableQueryState } from "./query";

interface Row {
  name: string;
  category: string;
}

const rows: Row[] = [
  { name: "Beta", category: "B" },
  { name: "Alpha", category: "A" },
  { name: "Gamma", category: "A" },
];

describe("Table Kit query contract", () => {
  it("normalizes unsafe pagination values and search whitespace", () => {
    expect(normalizeTableQueryState({ search: "  alpha ", pageIndex: -1, pageSize: 0 })).toEqual({
      search: "alpha",
      filters: {},
      sort: [],
      pageIndex: 0,
      pageSize: 1,
    });
  });

  it("composes search, filter, sort, and pagination against one result set", () => {
    const result = deriveClientQuery(
      {
        search: "a",
        filters: { category: "A" },
        sort: [{ columnId: "name", direction: "descending" }],
        pageIndex: 0,
        pageSize: 1,
      },
      {
        rows,
        searchText: (row) => row.name,
        filterValue: (row, columnId) => (columnId === "category" ? row.category : undefined),
        compare: (left, right, columnId) => (columnId === "name" ? left.name.localeCompare(right.name) : 0),
      },
    );

    expect(result.total).toBe(2);
    expect(result.rows).toEqual([{ name: "Gamma", category: "A" }]);
  });
});
