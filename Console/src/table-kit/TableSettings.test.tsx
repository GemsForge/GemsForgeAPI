import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../design-system/tamagui.config";
import { TableSettingsMenu } from "./TableSettings";

describe("TableSettingsMenu", () => {
  it("opens the reference-style settings panel and restores focus", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <TableSettingsMenu viewId="gallery" onViewChange={vi.fn()} />
      </TamaguiProvider>,
    );

    const trigger = screen.getByRole("button", { name: "View settings" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "View settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    expect(screen.getByRole("dialog", { name: "Layout" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Layout" }), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "View settings" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "View settings" }), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("updates layout, group, filter, and sort through controlled callbacks", () => {
    const onViewChange = vi.fn();
    const onGroupBy = vi.fn();
    const onFilter = vi.fn();
    const onSort = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <TableSettingsMenu
          viewId="table"
          onViewChange={onViewChange}
          groupBy=""
          groupOptions={[{ value: "status", label: "Status" }]}
          onGroupBy={onGroupBy}
          filterOptions={["Active"]}
          onFilter={onFilter}
          sortOptions={[{ value: "name", label: "Name" }]}
          onSort={onSort}
        />
      </TamaguiProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "View settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByRole("radio", { name: "Gallery" }));
    fireEvent.click(screen.getByRole("button", { name: "View settings" }));
    fireEvent.click(screen.getByRole("button", { name: "View settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to view settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Group" }));
    fireEvent.click(screen.getByRole("radio", { name: "Status" }));
    expect(onViewChange).toHaveBeenCalledWith("gallery");
    expect(onGroupBy).toHaveBeenCalledWith("status");
    expect(onFilter).not.toHaveBeenCalled();
    expect(onSort).not.toHaveBeenCalled();
  });
});
