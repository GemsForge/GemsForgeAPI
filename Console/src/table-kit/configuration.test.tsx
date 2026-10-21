import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeTablePropertyConfiguration,
  TablePropertyControls,
  useTablePropertyConfiguration,
  type TablePropertyOption,
} from "./index";

const properties: TablePropertyOption[] = [
  { id: "name", label: "Name" },
  { id: "status", label: "Status" },
  { id: "owner", label: "Owner" },
];

describe("Table Kit property configuration", () => {
  it("removes stale metadata and appends newly available properties", () => {
    expect(
      normalizeTablePropertyConfiguration(
        { order: ["status", "missing"], hiddenIds: ["missing", "owner"] },
        properties,
      ),
    ).toEqual({
      configuration: { order: ["status", "name", "owner"], hiddenIds: ["owner"] },
      missingPropertyIds: ["missing"],
    });
  });

  it("restores uncontrolled configuration per view and emits serializable metadata", () => {
    const onConfigurationChange = vi.fn();
    const hook = renderHook(
      ({ viewId }) =>
        useTablePropertyConfiguration({
          properties,
          viewId,
          viewConfigurations: { list: { order: ["status", "name", "owner"], hiddenIds: ["owner"] } },
          onConfigurationChange,
        }),
      { initialProps: { viewId: "grid" } },
    );

    act(() => hook.result.current.setVisibility("status", false));
    act(() => hook.rerender({ viewId: "list" }));
    expect(hook.result.current.visibleIds).toEqual(["status", "name"]);
    act(() => hook.rerender({ viewId: "grid" }));
    expect(hook.result.current.visibleIds).toEqual(["name", "owner"]);
    expect(onConfigurationChange).toHaveBeenCalledWith(
      { order: ["name", "status", "owner"], hiddenIds: ["status"] },
      { viewId: "grid", missingPropertyIds: [] },
    );
  });

  it("surfaces stale persisted properties for visible recovery feedback", () => {
    const hook = renderHook(() =>
      useTablePropertyConfiguration({
        properties,
        viewId: "grid",
        viewConfigurations: { grid: { order: ["name", "removed"], hiddenIds: ["removed"] } },
      }),
    );

    expect(hook.result.current.missingPropertyIds).toEqual(["removed"]);
    expect(hook.result.current.visibleIds).toEqual(["name", "status", "owner"]);
  });

  it("supports ordering, show all, hide all, and reset operations", () => {
    const hook = renderHook(() => useTablePropertyConfiguration({ properties }));
    act(() => hook.result.current.move("status", "up"));
    expect(hook.result.current.configuration.order).toEqual(["status", "name", "owner"]);
    act(() => hook.result.current.hideAll());
    expect(hook.result.current.visibleIds).toEqual([]);
    act(() => hook.result.current.showAll());
    expect(hook.result.current.visibleIds).toEqual(["status", "name", "owner"]);
    act(() => hook.result.current.reset());
    expect(hook.result.current.configuration.order).toEqual(["name", "status", "owner"]);
  });

  it("provides an accessible searchable property menu", () => {
    const hook = renderHook(() => useTablePropertyConfiguration({ properties }));
    render(<TablePropertyControls properties={properties} configuration={hook.result.current} />);

    fireEvent.click(screen.getByRole("button", { name: "Properties" }));
    expect(screen.getByRole("dialog", { name: "Properties" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search properties" }), {
      target: { value: "owner" },
    });
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
  });
});
