import { describe, expect, it, vi } from "vitest";
import type {
  TableNewRecordOperationOption,
  TableNewRecordOperations,
  TableUtilityMenuId,
  TableUtilityMenuState,
  TableViewId,
  TableViewSelection,
} from "./index";

describe("Table Kit compact header contracts", () => {
  it("models one supported view selection", () => {
    const onViewChange = vi.fn<(viewId: TableViewId) => void>();
    const selection: TableViewSelection = {
      label: "Table views",
      viewId: "list",
      onViewChange,
    };

    selection.onViewChange("gallery");

    expect(selection.viewId).toBe("list");
    expect(onViewChange).toHaveBeenCalledWith("gallery");
  });

  it("models one labeled utility menu at a time", () => {
    const onOpenMenu = vi.fn<(menu: TableUtilityMenuId) => void>();
    const state: TableUtilityMenuState = {
      labels: {
        search: "Search",
        sort: "Sort",
        filter: "Filter",
        properties: "Properties",
      },
      openMenu: "sort",
      onOpenMenu,
      onCloseMenu: vi.fn(),
    };

    state.onOpenMenu("properties");

    expect(state.labels.properties).toBe("Properties");
    expect(onOpenMenu).toHaveBeenCalledWith("properties");
  });

  it("keeps New Record operation labels and handlers typed", async () => {
    const onSelect = vi.fn<() => void | Promise<void>>();
    const options: TableNewRecordOperationOption[] = [
      { id: "create", operation: "create", label: "Create record", onSelect },
      { id: "import", operation: "import", label: "Import records", onSelect },
      { id: "paste", operation: "paste", label: "Paste records", onSelect },
    ];
    const menu: TableNewRecordOperations = { label: "New Record options", options };

    await menu.options[2].onSelect();

    expect(menu.label).toBe("New Record options");
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
