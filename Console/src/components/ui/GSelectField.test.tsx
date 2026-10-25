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
});
