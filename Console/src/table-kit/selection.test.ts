import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTableSelection } from "./selection";

describe("Table Kit selection", () => {
  it("supports single, all, and clear selection", () => {
    const hook = renderHook(() => useTableSelection());
    act(() => hook.result.current.toggle("one"));
    expect(hook.result.current.selectedIds).toEqual(new Set(["one"]));
    act(() => hook.result.current.selectAll(["one", "two"]));
    expect(hook.result.current.selectedIds).toEqual(new Set(["one", "two"]));
    act(() => hook.result.current.clear());
    expect(hook.result.current.selectedIds.size).toBe(0);
  });

  it("adds a drag-selected range atomically without toggling existing IDs", () => {
    const hook = renderHook(() => useTableSelection<string>({ defaultSelectedIds: ["one"] }));

    act(() => hook.result.current.add(["one", "two", "three"]));

    expect(hook.result.current.selectedIds).toEqual(new Set(["one", "two", "three"]));
  });

  it("preserves selections outside a bulk-action scope and reports partial selection", () => {
    const hook = renderHook(() => useTableSelection<string>({ defaultSelectedIds: ["off-page", "one"] }));

    expect(hook.result.current.getSummary(["one", "two"])).toEqual({
      ids: ["one", "two"],
      selectedCount: 1,
      totalCount: 2,
      allSelected: false,
      indeterminate: true,
    });

    act(() => hook.result.current.toggleAll(["one", "two"]));
    expect(hook.result.current.selectedIds).toEqual(new Set(["off-page", "one", "two"]));

    act(() => hook.result.current.toggleAll(["one", "two"]));
    expect(hook.result.current.selectedIds).toEqual(new Set(["off-page"]));
  });

  it("supports controlled selection changes without owning the external state", () => {
    const onSelectionChange = vi.fn();
    const hook = renderHook(() => useTableSelection({ selectedIds: new Set(["one"]), onSelectionChange }));

    act(() => hook.result.current.toggle("two"));

    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["one", "two"]));
    expect(hook.result.current.selectedIds).toEqual(new Set(["one"]));
  });
});
