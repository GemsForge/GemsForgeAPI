import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { gemColors } from "@gemsforge/ui";

// Vitest stubs CSS imports, so read the stylesheet itself.
const appStyles = readFileSync(resolve(__dirname, "styles.css"), "utf8");

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
function token(name: string) {
  return appStyles.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "i"))?.[1] ?? "";
}

/** In-canvas (.wireframe-demo) fields use this stylesheet token, not the Tamagui theme. */
describe("wireframe field border", () => {
  const border = token("gem-wireframe-field-border");
  it.each([gemColors.wireframePanel, gemColors.wireframePanelLight, gemColors.wireframeCanvas])(
    "meets 3:1 (WCAG 1.4.11) on %s and stays below the focus colour",
    (surface) => {
      expect(border).toMatch(/^#[0-9a-f]{6}$/i);
      expect(contrast(border, surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(token("gem-wireframe-action"), surface)).toBeGreaterThan(contrast(border, surface));
    },
  );
});

/** Legacy field CSS falls back to these when no Tamagui theme sets --fieldBorder. */
describe("stylesheet field border fallbacks", () => {
  it.each([
    ["gem-field-border", gemColors.gemFieldLine],
    ["gem-knowledge-field-border", gemColors.gemKnowledgeFieldLine],
    ["gem-wireframe-field-border", gemColors.wireframeMuted],
  ])("--%s matches the theme field border %s", (name, expected) => {
    expect(token(name).toLowerCase()).toBe(expected);
  });
});
