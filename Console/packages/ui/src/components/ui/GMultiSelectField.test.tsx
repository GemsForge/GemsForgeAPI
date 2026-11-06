import { fireEvent, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "../../design-system";
import { GMultiSelectField, decodeMultiSelectValue, encodeMultiSelectValue } from "./GMultiSelectField";

describe("GMultiSelectField", () => {
  it("edits selected values and saves them as semicolon-delimited text", () => {
    const onSave = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <GMultiSelectField
          label="Tags"
          value="low;high"
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ]}
          onSave={onSave}
          onCancel={vi.fn()}
        />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("checkbox", { name: "Low" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Medium" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith("low;high;medium");
  });

  it("decodes and encodes with a semicolon delimiter and removes duplicates", () => {
    expect(decodeMultiSelectValue("low; high;low;;")).toEqual(["low", "high"]);
    expect(encodeMultiSelectValue(["low", "high", "low"])).toBe("low;high");
  });
});
