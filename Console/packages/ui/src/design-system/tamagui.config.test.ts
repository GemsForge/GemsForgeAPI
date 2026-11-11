import { describe, expect, it } from "vitest";
import {
  gemBreakpoints,
  gemColors,
  gemElevation,
  gemFontFamily,
  gemLayout,
  gemMotion,
  gemRadii,
  gemSpacing,
  gemZIndex,
  tamaguiConfig,
} from "./tamagui.config";

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
    expect(gemFontFamily).toMatch(/^"Avenir Next"/);
    expect(gemSpacing.section).toBeGreaterThan(gemSpacing.control);
    expect(gemRadii.card).toBeGreaterThan(gemRadii.control);
    expect(gemColors.lightCanvas).toBe("#f3f8f7");
    expect(tamaguiConfig.themes.light.background.val).toBe(gemColors.lightCanvas);
    expect(tamaguiConfig.themes.dark).toBeDefined();
    expect(tamaguiConfig.themes.light).toBeDefined();
  });

  it("defines shared layout, motion, sizing, layering, and semantic theme roles", () => {
    expect(gemLayout).toEqual({
      appHeader: 72,
      appSidebarExpanded: 288,
      appSidebarCollapsed: 68,
      appSidebarMaximum: 360,
      appContentMinimum: 420,
      appSidebarLabelThreshold: 160,
      workspaceSidebar: 256,
      workspaceSidebarCompact: 208,
      inspector: 384,
      inspectorCompact: 320,
    });
    expect(gemMotion).toEqual({ quick: 120, standard: 180, emphasized: 240 });
    expect(gemElevation.card).toContain("rgba(0, 0, 0");
    expect(gemElevation.floating).toContain("32px");
    expect(tamaguiConfig.tokens.size.gemTouchTarget.val).toBe(44);
    expect(tamaguiConfig.tokens.size.gemAppSidebarExpanded.val).toBe(gemLayout.appSidebarExpanded);
    expect(tamaguiConfig.tokens.size.gemAppContentMinimum.val).toBe(gemLayout.appContentMinimum);
    expect(tamaguiConfig.tokens.space.gemBorderHairline.val).toBe(1);
    expect(gemZIndex.floating).toBeLessThan(gemZIndex.dialog);
    expect(gemZIndex.dialog).toBeLessThan(gemZIndex.popover);
    expect(gemZIndex.popover).toBeLessThan(gemZIndex.notification);
    expect(tamaguiConfig.tokens.zIndex.gemPopover.val).toBe(gemZIndex.popover);
    expect(tamaguiConfig.tokens.zIndex.gemNotification.val).toBeGreaterThan(tamaguiConfig.tokens.zIndex.gemDialog.val);
    expect(tamaguiConfig.themes.dark.surface.val).toBe(gemColors.gemPanel);
    expect(tamaguiConfig.themes.dark.focus.val).toBe(gemColors.gemMint);
    expect(tamaguiConfig.themes.dark.actionText.val).toBe(gemColors.gemCanvas);
    expect(tamaguiConfig.themes.dark.warning.val).toBe(gemColors.gemGold);
    expect(tamaguiConfig.themes.light.surface.val).toBe(gemColors.wireframePanel);
    expect(tamaguiConfig.themes.light.focus.val).toBe(gemColors.wireframeMint);
    expect(tamaguiConfig.themes.light.actionText.val).toBe(gemColors.wireframePanel);
    expect(tamaguiConfig.themes.light.warning.val).toBe(gemColors.wireframeGold);
  });

  it("resolves every theme value to a concrete value instead of a $token reference", () => {
    const unresolved = Object.entries(tamaguiConfig.themes).flatMap(([themeName, theme]) =>
      Object.entries(theme as Record<string, { val: unknown }>)
        .filter(([, variable]) => typeof variable?.val === "string" && variable.val.startsWith("$"))
        .map(([key, variable]) => `${themeName}.${key} = ${String(variable.val)}`),
    );
    expect(unresolved).toEqual([]);
    expect(tamaguiConfig.themes.knowledge.borderColor.val).toBe(gemColors.gemKnowledgeLine);
    expect(tamaguiConfig.themes.dark.borderColor.val).toBe(gemColors.gemPanelLight);
  });
});
