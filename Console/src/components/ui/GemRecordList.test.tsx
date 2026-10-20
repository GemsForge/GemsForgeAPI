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

    fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
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

    fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
    expect(screen.getByRole("button", { name: "One" })).toBeInTheDocument();
    expect(screen.queryByText("Details should stay in List view")).not.toBeInTheDocument();
    expect(document.querySelector('[data-card-view="grid"]')).toBeTruthy();
  });
});
