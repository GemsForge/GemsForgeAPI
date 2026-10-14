import { describe, expect, it } from "vitest";
import { gemColors } from "./tamagui.config";
function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(a: string, b: string) { const values = [luminance(a), luminance(b)].sort((x, y) => y - x); return (values[0] + .05) / (values[1] + .05); }
describe("text contrast expectations", () => {
  it.each([
    [gemColors.gemInk, gemColors.gemCanvas], [gemColors.gemMuted, gemColors.gemPanel],
    [gemColors.gemCanvas, gemColors.gemMint], [gemColors.gemCanvas, gemColors.gemDanger],
    [gemColors.gemInk, gemColors.gemMintDark],
  ])("meets 4.5:1 for %s on %s", (foreground, background) => { expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5); });
});
