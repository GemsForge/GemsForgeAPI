import {
  createSwitch,
  SwitchFrame as SwitchBehaviorFrame,
  SwitchThumbFrame as SwitchBehaviorThumbFrame,
} from "@tamagui/switch";
import { type ComponentSize, type GetProps, resolveSizing, styled } from "@tamagui/core";

export type SwitchSize = ComponentSize | boolean;

const THUMB_INSET = 2;

const getSwitchTrackSize = styled.dynamic<SwitchSize>((value, environment) => {
  const sizing = resolveSizing(value, environment);
  if (!sizing) return;
  return {
    width: Math.round(sizing.square * 1.9),
    height: sizing.square,
    minHeight: sizing.square,
  };
});

const getSwitchThumbSize = styled.dynamic<SwitchSize>((value, environment) => {
  const sizing = resolveSizing(value, environment);
  if (!sizing) return;
  const side = sizing.square - THUMB_INSET * 2;
  return { width: side, height: side };
});

/** Project-owned Tamagui switch skin matching the registry component contract. */
export const SwitchFrame = styled(SwitchBehaviorFrame, {
  displayName: "Switch",
  borderRadius: 1000,
  padding: THUMB_INSET,
  outlineColor: "focus-visible:outline-color",
  outlineStyle: "focus-visible:solid",
  outlineWidth: "focus-visible:2px",
  variants: {
    size: getSwitchTrackSize,
    active: {
      true: { backgroundColor: "background" },
      false: { backgroundColor: "color-4 hover:color-5" },
    },
    disabled: {
      true: { cursor: "not-allowed", opacity: 0.45 },
    },
  } as const,
  defaultVariants: { size: "md" },
});

/** Project-owned Tamagui switch thumb skin with registry sizing and motion. */
export const SwitchThumbFrame = styled(SwitchBehaviorThumbFrame, {
  displayName: "SwitchThumb",
  borderRadius: 1000,
  boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
  variants: {
    size: getSwitchThumbSize,
    active: {
      true: { backgroundColor: "color" },
      false: { backgroundColor: "white" },
    },
  } as const,
  defaultVariants: { size: "md" },
});

export const Switch = createSwitch({
  Frame: SwitchFrame,
  Thumb: SwitchThumbFrame,
  activeTheme: "brand",
});

export const SwitchThumb = Switch.Thumb;
export type SwitchProps = GetProps<typeof Switch>;
