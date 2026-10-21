import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
