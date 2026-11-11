import { fireEvent, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "../../design-system";
import { GStructuralField } from "./GStructuralField";

describe("GStructuralField", () => {
  it.each(["relation", "lookup"] as const)("searches and selects a %s option", (kind) => {
    const onSearchChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GStructuralField
          kind={kind}
          label="Category"
          search=""
          options={[{ value: "food", label: "Food" }]}
          onSearchChange={onSearchChange}
          onSelect={onSelect}
        />
      </TamaguiProvider>,
    );

    const search = screen.getByRole("searchbox", {
      name: kind === "relation" ? "Search Category records" : "Search records for Category",
    });
    expect(screen.getByRole("option", { name: "Food" })).toBeVisible();
    fireEvent.change(search, { target: { value: "foo" } });
    expect(onSearchChange).toHaveBeenCalledWith("foo");
    fireEvent.click(screen.getByRole("option", { name: "Food" }));
    expect(onSelect).toHaveBeenCalledWith({ value: "food", label: "Food" });
  });
});
