import { fireEvent, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it } from "vitest";
import { tamaguiConfig } from "@gemsforge/ui";
import { WireframePropertyEditor } from "./WireframePropertyEditor";

describe("WireframePropertyEditor metadata", () => {
  it("opens with the inferred currency type and dollar icon selected", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <WireframePropertyEditor label="Monthly amount" value="$125.00" kind="number" />
      </TamaguiProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Edit Monthly amount property" });
    fireEvent.click(trigger);

    expect(screen.getByRole("textbox", { name: "Property name" })).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Primitive type" })).toHaveTextContent("Currency");
    expect(screen.getByRole("radio", { name: "Currency" })).toHaveAttribute("aria-checked", "true");

    const closeButton = screen.getByRole("button", { name: "Close property editor" });
    closeButton.focus();
    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Save property settings" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Edit property" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on backdrop click and returns focus to its trigger", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <WireframePropertyEditor label="Monthly amount" value="$125.00" kind="number" />
      </TamaguiProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Edit Monthly amount property" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("presentation"));

    expect(screen.queryByRole("dialog", { name: "Edit property" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
