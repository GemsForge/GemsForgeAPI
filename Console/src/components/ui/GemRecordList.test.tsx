import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../../design-system";
import { GemRecordList } from "./GemRecordList";

describe("GemRecordList views", () => {
  it("switches to a navigable grid without changing the selected record contract", () => {
    const onExpandedChange = vi.fn();
    const records = [
      { id: "one", title: "One" },
      { id: "two", title: "Two" },
    ];
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GemRecordList
          records={records}
          label="Example"
          getKey={(record) => record.id}
          renderRecord={(record) => (
            <button type="button" onClick={() => onExpandedChange(record.id)}>
              {record.title}
            </button>
          )}
          isExpanded={(record) => record.id === "one"}
          onExpandedChange={onExpandedChange}
        />
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByText("View: List"));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Gallery" }));
    expect(screen.getByRole("button", { name: "Next example record" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Next example record" }));
    expect(onExpandedChange).toHaveBeenCalledWith("two");
    expect(screen.getByRole("button", { name: "Previous example record" })).toBeDisabled();
  });

  it("uses fixed Tamagui Cards without inline expandable details in Grid view", () => {
    const records = [{ id: "one", title: "One" }];
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GemRecordList
          records={records}
          label="Example"
          getKey={(record) => record.id}
          renderRecord={(record) => <button type="button">{record.title}</button>}
          isExpanded={() => true}
          renderExpanded={() => <div>Details should stay in List view</div>}
        />
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByText("View: List"));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Gallery" }));
    expect(screen.getByRole("button", { name: "One" })).toBeInTheDocument();
    expect(screen.queryByText("Details should stay in List view")).not.toBeInTheDocument();
    const activeCard = document.querySelector('[data-card-view="grid"]');
    expect(activeCard).toHaveClass("is-active");
    expect(activeCard).not.toHaveStyle({ transform: "scale(1.03)" });
  });

  it("configures visible table properties from an accessible menu", () => {
    const records = [{ id: "one", title: "One" }];
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GemRecordList
          records={records}
          label="Example"
          getKey={(record) => record.id}
          renderRecord={(record) => <button type="button">{record.title}</button>}
          tableColumns={[
            { key: "title", label: "Title", render: (record) => record.title },
            { key: "id", label: "Item ID", render: (record) => record.id },
          ]}
        />
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByText("Properties"));
    expect(screen.getByRole("checkbox", { name: "Show Title property" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Show Item ID property" }));
    fireEvent.click(screen.getByText("View: List"));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Table" }));
    expect(screen.getByRole("columnheader", { name: "Title" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Item ID" })).not.toBeInTheDocument();
  });

  it("keeps the table caption and drops properties removed by a feature", () => {
    const records = [{ id: "one", title: "One" }];
    const { rerender } = render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GemRecordList
          records={records}
          label="Example"
          getKey={(record) => record.id}
          renderRecord={(record) => <button type="button">{record.title}</button>}
          tableColumns={[{ key: "title", label: "Title", render: (record) => record.title }]}
        />
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByText("View: List"));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Table" }));
    expect(screen.getByRole("table", { name: "Example table" })).toBeInTheDocument();
    expect(screen.getByText("View: Table").closest("details")).not.toHaveAttribute("open");

    rerender(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GemRecordList
          records={records}
          label="Example"
          getKey={(record) => record.id}
          renderRecord={(record) => <button type="button">{record.title}</button>}
          tableColumns={[{ key: "id", label: "Item ID", render: (record) => record.id }]}
        />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("columnheader", { name: "Item ID" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Title" })).not.toBeInTheDocument();
  });
});
