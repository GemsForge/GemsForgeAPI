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
    fireEvent.keyDown(screen.getByRole("option", { name: "Number" }), { key: "Enter" });
    expect(screen.getByRole("combobox", { name: "Primitive type" })).toHaveTextContent("Number");

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

  it("offers Relation only for a relation-configured property", () => {
    const onSave = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <WireframePropertyIconProvider onSave={onSave} propertyTypes={{}} propertySelectOptions={{}}>
          <WireframePropertyEditor label="Category" value="Food" kind="relation" propertyID="category" />
        </WireframePropertyIconProvider>
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Category property" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Primitive type" }));
    expect(screen.getByRole("option", { name: "Relation" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Lookup" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save property settings" }));
    expect(onSave).toHaveBeenCalledWith("category", expect.any(String), "Relation", []);
  });

  it("offers Lookup only for a lookup-configured property", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <WireframePropertyEditor label="Source" value="Food" kind="lookup" propertyType="Lookup" />
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Source property" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Primitive type" }));
    expect(screen.getByRole("option", { name: "Lookup" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Relation" })).not.toBeInTheDocument();
  });

  it("hides Relation and Lookup for an unconfigured property", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <WireframePropertyEditor label="Amount" value="10" kind="number" />
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Amount property" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Primitive type" }));
    expect(screen.queryByRole("option", { name: "Relation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Lookup" })).not.toBeInTheDocument();
  });

  it("offers Multi-select on text properties and saves configured choices", () => {
    const onSave = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <WireframePropertyIconProvider onSave={onSave} propertyTypes={{}} propertySelectOptions={{}}>
          <WireframePropertyEditor label="Tags" value="home;work" kind="text" propertyID="tags" />
        </WireframePropertyIconProvider>
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Tags property" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Primitive type" }));
    fireEvent.keyDown(screen.getByRole("option", { name: "Multi-select" }), { key: "Enter" });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Select options (comma-separated; semicolons are reserved)" }),
      { target: { value: "home, work, travel" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save property settings" }));

    expect(onSave).toHaveBeenCalledWith("tags", expect.any(String), "Multi-select", ["home", "work", "travel"]);
  });

  it("saves choices for a property changed to Select", () => {
    const onSave = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <WireframePropertyIconProvider onSave={onSave} propertyTypes={{}} propertySelectOptions={{}}>
          <WireframePropertyEditor label="Amount" value="10" kind="number" propertyID="amount" />
        </WireframePropertyIconProvider>
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Amount property" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Primitive type" }));
    fireEvent.keyDown(screen.getByRole("option", { name: "Select" }), { key: "Enter" });
    expect(screen.getByRole("button", { name: "Save property settings" })).toBeDisabled();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Select options (comma-separated; semicolons are reserved)" }),
      {
        target: { value: "10, 20, 30" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save property settings" }));

    expect(onSave).toHaveBeenCalledWith("amount", expect.any(String), "Select", ["10", "20", "30"]);
  });
});
