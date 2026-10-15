import { createFont, createTamagui } from "tamagui";
import { defaultConfig } from "@tamagui/config/v5";

export const gemColors = {
  gemCanvas: "#0b171c",
  gemPanel: "#12252b",
  gemPanelLight: "#173138",
  gemInk: "#edf4f4",
  gemMuted: "#8da2a5",
  gemMint: "#78d1bd",
  gemMintDark: "#1d574f",
  gemGold: "#f0bd73",
  gemDanger: "#f08a83",
};

export const gemBreakpoints = { compact: 640, tablet: 900, desktop: 1200 } as const;
export const gemSpacing = { compact: 8, control: 12, section: 24, page: 32 } as const;
export const gemRadii = { control: 8, card: 16 } as const;
const bodyFont = createFont({
  family: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
  size: { 1: 12, 2: 14, 3: 16, 4: 20, 5: 28, 6: 36, true: 16 },
  lineHeight: { 1: 18, 2: 21, 3: 24, 4: 28, 5: 36, 6: 44, true: 24 },
  weight: { 1: "400", 2: "500", 3: "600", 4: "700", 5: "700", 6: "800", true: "400" },
  letterSpacing: { 1: 0, 2: 0, 3: 0, 4: -0.2, 5: -0.5, 6: -1, true: 0 },
});

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  fonts: { ...defaultConfig.fonts, body: bodyFont, heading: bodyFont },
  media: {
    ...defaultConfig.media,
    compact: { maxWidth: gemBreakpoints.compact },
    tablet: { maxWidth: gemBreakpoints.tablet },
    desktop: { minWidth: gemBreakpoints.desktop },
    reducedMotion: { prefersReducedMotion: "reduce" },
  },
  tokens: {
    ...defaultConfig.tokens,
    color: gemColors,
    space: {
      ...defaultConfig.tokens.space,
      gemCompact: gemSpacing.compact,
      gemControl: gemSpacing.control,
      gemSection: gemSpacing.section,
      gemPage: gemSpacing.page,
    },
    radius: { ...defaultConfig.tokens.radius, gemControl: gemRadii.control, gemCard: gemRadii.card },
  },
  themes: {
    ...defaultConfig.themes,
    dark: {
      ...defaultConfig.themes.dark,
      background: "$gemCanvas",
      color: "$gemInk",
      borderColor: "$gemPanelLight",
    },
    light: {
      ...defaultConfig.themes.light,
      background: "#f3f8f7",
      color: "#12252b",
      borderColor: "#c2d4d1",
    },
  },
});

export type GemLifeTamaguiConfig = typeof tamaguiConfig;
