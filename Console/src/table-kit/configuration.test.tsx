import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../design-system/tamagui.config";
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

  it("hydrates a clean active view when persisted metadata arrives after mount", () => {
    const hook = renderHook(
      ({ viewConfigurations }) => useTablePropertyConfiguration({ properties, viewId: "grid", viewConfigurations }),
      { initialProps: { viewConfigurations: {} } },
    );

    expect(hook.result.current.visibleIds).toEqual(["name", "status", "owner"]);
    act(() =>
      hook.rerender({
        viewConfigurations: { grid: { order: ["owner", "name", "status"], hiddenIds: ["status"] } },
      }),
    );

    expect(hook.result.current.configuration.order).toEqual(["owner", "name", "status"]);
    expect(hook.result.current.visibleIds).toEqual(["owner", "name"]);
  });

  it("does not replace local view edits when persisted metadata refreshes", () => {
    const hook = renderHook(
      ({ viewConfigurations }) => useTablePropertyConfiguration({ properties, viewId: "grid", viewConfigurations }),
      { initialProps: { viewConfigurations: {} } },
    );

    act(() => hook.result.current.setVisibility("status", false));
    act(() =>
      hook.rerender({
        viewConfigurations: { grid: { order: ["owner", "name", "status"], hiddenIds: [] } },
      }),
    );

    expect(hook.result.current.visibleIds).toEqual(["name", "owner"]);
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
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <TablePropertyControls properties={properties} configuration={hook.result.current} />
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Properties" }));
    expect(screen.getByRole("dialog", { name: "Properties" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search properties" })).toHaveFocus();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search properties" }), {
      target: { value: "owner" },
    });
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Properties" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Properties" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Properties" })).toHaveFocus();
  });
});
