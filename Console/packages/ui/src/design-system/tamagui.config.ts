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
  gemShellCanvas: "#203b33",
  gemShellSurface: "#2a483c",
  gemShellLine: "#4c6658",
  gemShellInk: "#f1f1e6",
  gemShellMuted: "#c0cabe",
  gemShellMint: "#a9d4bc",
  gemShellActive: "#3b5949",
  gemKnowledgeCanvas: "#f2f3e7",
  gemKnowledgePanel: "#faf9f2",
  gemKnowledgePanelLight: "#e7ebdc",
  gemKnowledgeInk: "#263d36",
  gemKnowledgeMuted: "#59675e",
  gemKnowledgeLine: "#d5ddd1",
  gemKnowledgeMint: "#3f7055",
  gemKnowledgeGold: "#85602a",
  gemKnowledgeActionText: "#ffffff",
  wireframeCanvas: "#f7f7f4",
  wireframePanel: "#ffffff",
  wireframeSidebar: "#fbfbf9",
  wireframePanelLight: "#e8f1ef",
  wireframeInk: "#233c42",
  wireframeHeading: "#173d45",
  wireframeMuted: "#738187",
  wireframeLine: "#dfe6e3",
  wireframeMint: "#39736d",
  wireframeGold: "#9a6b22",
  wireframeGoldLight: "#fff5e2",
  lightCanvas: "#f3f8f7",
  lightInk: "#12252b",
  lightBorder: "#c2d4d1",
};

export const gemBreakpoints = { compact: 640, tablet: 900, desktop: 1200 } as const;
export const gemSpacing = { compact: 8, control: 12, section: 24, page: 32 } as const;
export const gemRadii = { control: 8, card: 16 } as const;
export const wireframeSpacing = { pane: 16, content: 28, card: 12 } as const;
export const wireframeRadii = { control: 8, card: 12, pill: 999 } as const;

/** Stable shell geometry shared by the application frame and workspace recipes. */
export const gemLayout = {
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
} as const;

/** Timing roles for small transitions; reduced motion disables nonessential motion. */
export const gemMotion = { quick: 120, standard: 180, emphasized: 240 } as const;

/** Shared surface depth for cards and floating content across both canvases. */
export const gemElevation = {
  card: "0 3px 12px rgba(0, 0, 0, 0.08)",
  floating: "0 12px 32px rgba(0, 0, 0, 0.18)",
} as const;

export const gemZIndex = {
  content: 0,
  sticky: 10,
  floating: 100,
  dialog: 200,
  popover: 250,
  notification: 300,
} as const;

export const gemFontFamily =
  '"Avenir Next", Avenir, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';

const bodyFont = createFont({
  family: gemFontFamily,
  size: { 1: 12, 2: 13, 3: 14, 4: 16, 5: 22, 6: 30, true: 14 },
  lineHeight: { 1: 16, 2: 18, 3: 20, 4: 24, 5: 28, 6: 38, true: 20 },
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
      wireframePane: wireframeSpacing.pane,
      wireframeContent: wireframeSpacing.content,
      wireframeCard: wireframeSpacing.card,
      gemBorderHairline: 1,
      gemBorderEmphasis: 2,
    },
    size: {
      ...defaultConfig.tokens.size,
      fieldShort: 192,
      fieldMedium: 320,
      fieldControl: 44,
      gemAppHeader: gemLayout.appHeader,
      gemAppSidebarExpanded: gemLayout.appSidebarExpanded,
      gemAppSidebarCollapsed: gemLayout.appSidebarCollapsed,
      gemAppSidebarMaximum: gemLayout.appSidebarMaximum,
      gemAppContentMinimum: gemLayout.appContentMinimum,
      gemAppSidebarLabelThreshold: gemLayout.appSidebarLabelThreshold,
      gemWorkspaceSidebar: gemLayout.workspaceSidebar,
      gemWorkspaceSidebarCompact: gemLayout.workspaceSidebarCompact,
      gemInspector: gemLayout.inspector,
      gemInspectorCompact: gemLayout.inspectorCompact,
      gemTouchTarget: 44,
    },
    radius: {
      ...defaultConfig.tokens.radius,
      gemControl: gemRadii.control,
      gemCard: gemRadii.card,
      wireframeControl: wireframeRadii.control,
      wireframeCard: wireframeRadii.card,
      wireframePill: wireframeRadii.pill,
    },
    zIndex: {
      ...defaultConfig.tokens.zIndex,
      gemContent: gemZIndex.content,
      gemSticky: gemZIndex.sticky,
      gemFloating: gemZIndex.floating,
      gemDialog: gemZIndex.dialog,
      gemPopover: gemZIndex.popover,
      gemNotification: gemZIndex.notification,
    },
  },
  // Tamagui v5 emits theme values verbatim as CSS variables, so "$token" strings
  // become invalid colours. Themes must reference raw palette values.
  themes: {
    ...defaultConfig.themes,
    dark: {
      ...defaultConfig.themes.dark,
      background: gemColors.gemCanvas,
      color: gemColors.gemInk,
      borderColor: gemColors.gemPanelLight,
      fieldLabel: gemColors.gemGold,
      fieldBackground: gemColors.gemCanvas,
      fieldBorder: gemColors.gemPanelLight,
      fieldText: gemColors.gemInk,
      fieldFocus: gemColors.gemMint,
      fieldMenuBackground: gemColors.gemPanel,
      fieldMenuHover: gemColors.gemPanelLight,
      fieldMenuText: gemColors.gemInk,
      surface: gemColors.gemPanel,
      surfaceRaised: gemColors.gemPanelLight,
      textMuted: gemColors.gemMuted,
      action: gemColors.gemMint,
      actionHover: gemColors.gemMintDark,
      actionText: gemColors.gemCanvas,
      focus: gemColors.gemMint,
      danger: gemColors.gemDanger,
      success: gemColors.gemMint,
      warning: gemColors.gemGold,
    },
    light: {
      ...defaultConfig.themes.light,
      background: gemColors.lightCanvas,
      color: gemColors.lightInk,
      borderColor: gemColors.lightBorder,
      fieldLabel: gemColors.gemGold,
      fieldBackground: gemColors.lightCanvas,
      fieldBorder: gemColors.lightBorder,
      fieldText: gemColors.lightInk,
      fieldFocus: gemColors.wireframeMint,
      fieldMenuBackground: gemColors.wireframePanel,
      fieldMenuHover: gemColors.wireframePanelLight,
      fieldMenuText: gemColors.lightInk,
      surface: gemColors.wireframePanel,
      surfaceRaised: gemColors.wireframePanelLight,
      textMuted: gemColors.wireframeMuted,
      action: gemColors.wireframeMint,
      actionHover: gemColors.wireframeHeading,
      actionText: gemColors.wireframePanel,
      focus: gemColors.wireframeMint,
      danger: gemColors.gemDanger,
      success: gemColors.wireframeMint,
      warning: gemColors.wireframeGold,
    },
    knowledge: {
      ...defaultConfig.themes.light,
      background: gemColors.gemKnowledgeCanvas,
      color: gemColors.gemKnowledgeInk,
      borderColor: gemColors.gemKnowledgeLine,
      fieldLabel: gemColors.gemKnowledgeMuted,
      fieldBackground: gemColors.gemKnowledgePanel,
      fieldBorder: gemColors.gemKnowledgeLine,
      fieldText: gemColors.gemKnowledgeInk,
      fieldFocus: gemColors.gemKnowledgeMint,
      fieldMenuBackground: gemColors.gemKnowledgePanel,
      fieldMenuHover: gemColors.gemKnowledgePanelLight,
      fieldMenuText: gemColors.gemKnowledgeInk,
      surface: gemColors.gemKnowledgePanel,
      surfaceRaised: gemColors.gemKnowledgePanelLight,
      textMuted: gemColors.gemKnowledgeMuted,
      action: gemColors.gemKnowledgeMint,
      actionHover: gemColors.gemKnowledgeInk,
      actionText: gemColors.gemKnowledgeActionText,
      focus: gemColors.gemKnowledgeMint,
      danger: gemColors.gemDanger,
      success: gemColors.gemKnowledgeMint,
      warning: gemColors.gemKnowledgeGold,
    },
  },
});

export type GemLifeTamaguiConfig = typeof tamaguiConfig;
