import { fireEvent, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it } from "vitest";
import { tamaguiConfig } from "../../design-system";
import { WireframePropertyEditor } from "./WireframePropertyEditor";

describe("WireframePropertyEditor metadata", () => {
  it("opens with the inferred currency type and dollar icon selected", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <WireframePropertyEditor label="Monthly amount" value="$125.00" kind="number" />
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Monthly amount property" }));

    expect(screen.getByRole("combobox", { name: "Primitive type" })).toHaveTextContent("Currency");
    expect(screen.getByRole("radio", { name: "Currency" })).toHaveAttribute("aria-checked", "true");
  });
});
