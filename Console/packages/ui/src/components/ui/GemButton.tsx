import type { ComponentProps } from "react";
import { Button } from "tamagui";

export interface GemButtonProps extends ComponentProps<typeof Button> {
  tone?: "primary" | "secondary" | "wireframe";
}

/** Shared Tamagui button that preserves native variants while applying Gem Life's semantic tones. */
export function GemButton({ tone = "primary", variant = "outlined", size = "sm", children, ...props }: GemButtonProps) {
  const isQuiet = variant === "quiet";
  const isWireframe = tone === "wireframe";
  // Outlined secondary controls use the theme's 3:1 control border, not the decorative hairline.
  const borderColor = isQuiet ? "transparent" : tone === "secondary" || isWireframe ? "$controlBorder" : "$action";
  return (
    <Button
      type="button"
      {...props}
      size={size}
      variant={variant}
      backgroundColor={isQuiet || tone === "secondary" ? "transparent" : isWireframe ? "$surface" : "$action"}
      borderColor={borderColor}
      borderWidth={1}
      borderRadius="$gemControl"
      color={isWireframe || tone === "secondary" ? "$color" : isQuiet ? "$action" : "$actionText"}
    >
      {children}
    </Button>
  );
}
