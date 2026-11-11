import { fireEvent, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "../../design-system";
import { GSelectField } from "./GSelectField";

/** Exercise Tamagui's selection event rather than assigning a button value. */
describe("GSelectField", () => {
  it("renders the selected label and reports a chosen option", () => {
    const onChange = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GSelectField
          label="Status"
          value="Current"
          options={[
            { label: "Current", value: "Current" },
            { label: "Former", value: "Former" },
          ]}
          onChange={onChange}
        />
      </TamaguiProvider>,
    );

    const trigger = screen.getByRole("combobox", { name: "Status" });
    expect(trigger).toHaveTextContent("Current");
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("option", { name: "Former" }), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("Former", expect.objectContaining({ reason: "keyboard" }));
  });

  it("marks its trigger and menu for the light workspace surface", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GSelectField label="Status" value="Current" options={[{ label: "Current", value: "Current" }]} wireframe />
      </TamaguiProvider>,
    );

    const trigger = screen.getByRole("combobox", { name: "Status" });
    expect(trigger).toHaveAttribute("data-wireframe-field", "true");
    fireEvent.click(trigger);
    expect(document.querySelector('[data-wireframe-select="true"]')).toBeInTheDocument();
  });

  it("links a read-mode error to the displayed value", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <GSelectField
          id="status"
          label="Status"
          value="Current"
          editing={false}
          onDisplayClick={vi.fn()}
          error="Choose a status."
          options={[{ label: "Current", value: "Current" }]}
          onChange={vi.fn()}
        />
      </TamaguiProvider>,
    );

    const value = screen.getByRole("button", { name: "Current" });
    expect(value).toHaveAccessibleDescription(/Choose a status\./);
    expect(screen.getByRole("alert")).toHaveAttribute("id", "status-error");
  });
});
