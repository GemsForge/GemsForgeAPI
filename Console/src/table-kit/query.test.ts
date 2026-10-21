import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { deriveClientQuery, normalizeTableQueryState, useTableQueryState } from "./query";

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

  it("restores uncontrolled query state per view and reports controlled changes", () => {
    const onStateChange = vi.fn();
    const hook = renderHook(({ viewId }) => useTableQueryState({ viewId, onStateChange }), {
      initialProps: { viewId: "grid" },
    });

    act(() => hook.result.current.setState((current) => ({ ...current, search: "grid" })));
    act(() => hook.rerender({ viewId: "list" }));
    expect(hook.result.current.state.search).toBe("");
    act(() => hook.result.current.setState((current) => ({ ...current, search: "list" })));
    act(() => hook.rerender({ viewId: "grid" }));

    expect(hook.result.current.state.search).toBe("grid");
    expect(onStateChange).toHaveBeenCalledTimes(2);
  });
});
