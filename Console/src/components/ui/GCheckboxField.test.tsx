import { fireEvent, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "../../design-system";
import { GCheckboxField } from "./GCheckboxField";

/** Verify the reusable checkbox contract without depending on a feature form. */
describe("GCheckboxField", () => {
  it("labels its controlled value and reports boolean changes", () => {
    const onChange = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GCheckboxField label="First receipt item" value={false} onChange={onChange} />
      </TamaguiProvider>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "First receipt item" });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
