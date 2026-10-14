import { describe, expect, it } from "vitest";
import { gemBreakpoints, gemColors, gemRadii, gemSpacing, tamaguiConfig } from "./tamagui.config";

describe("Gem Life design foundation", () => {
  it("preserves the established palette and defines ordered responsive thresholds", () => {
    expect(gemColors.gemCanvas).toBe("#0b171c");
    expect(gemColors.gemMint).toBe("#78d1bd");
    expect(gemBreakpoints.compact).toBeLessThan(gemBreakpoints.tablet);
    expect(gemBreakpoints.tablet).toBeLessThan(gemBreakpoints.desktop);
  });
  it("exposes typography, semantic spacing, radii, and both themes", () => {
    expect(tamaguiConfig.fonts.body).toBeDefined();
    expect(tamaguiConfig.fonts.heading).toBeDefined();
    expect(gemSpacing.section).toBeGreaterThan(gemSpacing.control);
    expect(gemRadii.card).toBeGreaterThan(gemRadii.control);
    expect(tamaguiConfig.themes.dark).toBeDefined();
    expect(tamaguiConfig.themes.light).toBeDefined();
  });
});
