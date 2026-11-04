import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "@gemsforge/ui";
import { TableSettingsMenu } from "./TableSettings";
import { useTablePropertyConfiguration } from "./configuration";

const listProperties = Array.from({ length: 7 }, (_, index) => ({
  id: `property-${index}`,
  label: `Property ${index}`,
}));

function ListSettingsFixture() {
  const configuration = useTablePropertyConfiguration({ properties: listProperties, viewId: "list" });
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <TableSettingsMenu
        viewId="list"
        onViewChange={vi.fn()}
        properties={listProperties}
        propertyConfiguration={configuration}
        maxVisibleProperties={5}
      />
    </TamaguiProvider>
  );
}

describe("TableSettingsMenu", () => {
  it("limits List visibility settings to five selected properties", async () => {
    render(<ListSettingsFixture />);

    fireEvent.click(screen.getByRole("button", { name: "View settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("5 of 5 properties selected"));
    expect(screen.getByLabelText("Property 5")).toBeDisabled();
    expect(screen.getByLabelText("Property 6")).toBeDisabled();
  });

  it("closes the entire settings panel when the pointer goes outside", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <>
          <button type="button">Outside</button>
          <TableSettingsMenu viewId="gallery" onViewChange={vi.fn()} />
        </>
      </TamaguiProvider>,
    );

    const trigger = screen.getByRole("button", { name: "View settings" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    expect(screen.getByRole("dialog", { name: "Layout" })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

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
