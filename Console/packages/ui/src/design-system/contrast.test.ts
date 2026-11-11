import { describe, expect, it } from "vitest";
import { gemColors, tamaguiConfig } from "./tamagui.config";
function luminance(hex: string) {
  const channels = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
describe("text contrast expectations", () => {
  it.each([
    [gemColors.gemInk, gemColors.gemCanvas],
    [gemColors.gemMuted, gemColors.gemPanel],
    [gemColors.gemCanvas, gemColors.gemMint],
    [gemColors.gemCanvas, gemColors.gemDanger],
    [gemColors.gemInk, gemColors.gemMintDark],
    // Field errors use the theme danger colour on light and knowledge surfaces.
    [gemColors.gemDangerOnLight, gemColors.gemKnowledgeCanvas],
    [gemColors.gemDangerOnLight, gemColors.gemKnowledgePanel],
    [gemColors.gemDangerOnLight, gemColors.lightCanvas],
    [gemColors.gemDangerOnLight, gemColors.wireframePanel],
  ])("meets 4.5:1 for %s on %s", (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});

/** Theme roles, not just tokens: app CSS and Gem fields read these through Tamagui's theme variables. */
describe("light theme roles", () => {
  const themes = { light: tamaguiConfig.themes.light, knowledge: tamaguiConfig.themes.knowledge };
  it.each(Object.entries(themes))("%s danger text meets 4.5:1 on its background and surface", (_, theme) => {
    for (const surface of [theme.background.val, theme.surface.val]) {
      expect(contrast(theme.danger.val as string, surface as string)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it.each(Object.entries(themes))("%s control border meets 3:1 on its background and surface", (_, theme) => {
    for (const surface of [theme.background.val, theme.surface.val]) {
      expect(contrast(theme.controlBorder.val as string, surface as string)).toBeGreaterThanOrEqual(3);
    }
  });
});

/** Field boundaries identify controls, so they need 3:1 (WCAG 1.4.11) in every theme. */
describe("field border roles", () => {
  const themes = {
    dark: tamaguiConfig.themes.dark,
    light: tamaguiConfig.themes.light,
    knowledge: tamaguiConfig.themes.knowledge,
  };
  const surfacesOf = (theme: (typeof themes)["light"]) =>
    [theme.fieldBackground, theme.background, theme.surface, theme.surfaceRaised].map((role) => role.val as string);
  it.each(Object.entries(themes))("%s field border meets 3:1 on the field and its surroundings", (_, theme) => {
    for (const surface of surfacesOf(theme)) {
      expect(contrast(theme.fieldBorder.val as string, surface)).toBeGreaterThanOrEqual(3);
    }
  });
  it.each(Object.entries(themes))("%s field focus is stronger than the resting border", (_, theme) => {
    for (const surface of surfacesOf(theme)) {
      expect(contrast(theme.fieldFocus.val as string, surface)).toBeGreaterThan(
        contrast(theme.fieldBorder.val as string, surface),
      );
    }
  });
});
