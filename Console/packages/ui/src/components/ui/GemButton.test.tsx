import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it } from "vitest";
import { GemButton } from "./GemButton";
import { tamaguiConfig } from "../../design-system";

describe("GemButton", () => {
  it("renders an accessible action button", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <GemButton>Save record</GemButton>
      </TamaguiProvider>,
    );

    expect(screen.getByRole("button", { name: "Save record" })).toBeInTheDocument();
  });

  it.each(["secondary", "wireframe"] as const)("outlines %s buttons with the theme control border", (tone) => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="knowledge">
        <GemButton tone={tone}>Edit list</GemButton>
      </TamaguiProvider>,
    );

    const button = screen.getByRole("button", { name: "Edit list" });
    const borderRules = [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && button.matches(rule.selectorText))
      .map((rule) => rule.style.borderTopColor || rule.style.borderColor)
      .filter(Boolean);
    expect(borderRules).toContain("var(--controlBorder)");
  });
});
