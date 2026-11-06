import { fireEvent, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "@gemsforge/ui";
import { WireframePropertyEditor, WireframePropertyIconProvider } from "./WireframePropertyEditor";

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

    fireEvent.click(screen.getByRole("combobox", { name: "Primitive type" }));
    fireEvent.keyDown(screen.getByRole("option", { name: "Text" }), { key: "Enter" });
    expect(screen.getByRole("combobox", { name: "Primitive type" })).toHaveTextContent("Text");

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

  it("offers Relation and Lookup types and saves the chosen type with its icon", () => {
    const onSave = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <WireframePropertyIconProvider onSave={onSave} propertyTypes={{}}>
          <WireframePropertyEditor label="Category" value="Food" propertyID="category" />
        </WireframePropertyIconProvider>
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Category property" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Primitive type" }));
    expect(screen.getByRole("option", { name: "Relation" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Lookup" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("option", { name: "Relation" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Save property settings" }));

    expect(onSave).toHaveBeenCalledWith("category", expect.any(String), "Relation");
  });
});
