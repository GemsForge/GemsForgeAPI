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

function renderDialog(onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <WireframePropertySettingsDialog property={property} onChange={vi.fn()} onClose={onClose} onSave={vi.fn()} />
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
});
