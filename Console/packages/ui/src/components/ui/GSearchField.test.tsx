import { fireEvent, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "../../design-system";
import { GSearchField } from "./GSearchField";

/** Cover the shared search input independently of address-provider behavior. */
describe("GSearchField", () => {
  it("reports regular search changes and an accessible error", () => {
    const onChange = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GSearchField label="Properties" value="" error="Try another term" onChange={onChange} />
      </TamaguiProvider>,
    );

    const input = screen.getByRole("searchbox", { name: "Properties" });
    fireEvent.change(input, { target: { value: "city" } });
    expect(onChange).toHaveBeenCalledWith("city");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Try another term");
  });

  it("offers address suggestions through the shared selection callback", () => {
    const onSelectSuggestion = vi.fn();
    const suggestion = { value: "address-1", label: "123 Main St" };
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GSearchField variant="address" suggestions={[suggestion]} onSelectSuggestion={onSelectSuggestion} />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Search for an address…");
    fireEvent.click(screen.getByRole("button", { name: "123 Main St" }));
    expect(onSelectSuggestion).toHaveBeenCalledWith(suggestion);
  });
});
