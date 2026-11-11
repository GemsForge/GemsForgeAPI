import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "@gemsforge/ui";
import { WireframePropertySettingsDialog, type WireframePropertyDetails } from "./WireframePropertySettingsDialog";

const property: WireframePropertyDetails = {
  id: "addressLine1",
  label: "Street address",
  value: "12 Main Street",
  type: "Text",
  icon: "MapPin",
  statusText: "",
  colorToken: "mint",
};

function renderDialog(onClose = vi.fn(), children?: ReactNode) {
  return {
    onClose,
    ...render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <WireframePropertySettingsDialog property={property} onChange={vi.fn()} onClose={onClose} onSave={vi.fn()}>
          {children}
        </WireframePropertySettingsDialog>
      </TamaguiProvider>,
    ),
  };
}

describe("WireframePropertySettingsDialog", () => {
  it("closes when the user clicks outside the dialog", () => {
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("presentation"));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays open when the user interacts inside the dialog", () => {
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("dialog", { name: "Property settings" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Property settings" })).toBeInTheDocument();
  });

  it("clarifies that custom settings and property appearance have separate save actions", () => {
    renderDialog(vi.fn(), <section>Relation settings</section>);

    expect(
      screen.getByText(/Save relation and lookup definitions with the button in that section/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save property settings" })).toHaveTextContent("Save");
  });

  it("requires and reports select choices in property settings", () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <WireframePropertySettingsDialog
          property={{ ...property, type: "Select", kind: "number", selectOptions: [] }}
          onChange={onChange}
          onClose={vi.fn()}
          onSave={onSave}
        />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("button", { name: "Save property settings" })).toBeDisabled();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Select options (comma-separated; semicolons are reserved)" }),
      {
        target: { value: "10, 20" },
      },
    );
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ selectOptions: ["10", "20"] }));
  });

  it("does not offer Relation or Lookup for an unconfigured property", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("combobox", { name: "Primitive type" }));

    expect(screen.queryByRole("option", { name: "Relation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Lookup" })).not.toBeInTheDocument();
  });
});
