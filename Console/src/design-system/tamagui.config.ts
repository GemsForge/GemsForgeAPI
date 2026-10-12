import { createTamagui } from "tamagui";
import { defaultConfig } from "@tamagui/config/v5";

const gemColors = {
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

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    color: gemColors,
  },
  themes: {
    ...defaultConfig.themes,
    dark: {
      ...defaultConfig.themes.dark,
      background: "$gemCanvas",
      color: "$gemInk",
      borderColor: "$gemPanelLight",
    },
  },
});

export type GemLifeTamaguiConfig = typeof tamaguiConfig;
