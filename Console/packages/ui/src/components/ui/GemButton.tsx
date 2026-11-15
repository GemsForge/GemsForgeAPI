import type { ComponentProps } from "react";
import { Button } from "tamagui";

export interface GemButtonProps extends ComponentProps<typeof Button> {
  tone?: "primary" | "secondary" | "wireframe";
}

/** Shared Tamagui button that preserves native variants while applying Gem Life's semantic tones. */
export function GemButton({
  tone = "primary",
  variant = "outlined",
  size = "sm",
  asChild,
  children,
  ...props
}: GemButtonProps) {
  const isQuiet = variant === "quiet";
  const isWireframe = tone === "wireframe";
  // Outlined secondary controls use the theme's 3:1 control border, not the decorative hairline.
  const borderColor = isQuiet ? "transparent" : tone === "secondary" || isWireframe ? "$controlBorder" : "$action";
  // Tamagui's Button still renders a native <button> around an asChild child, which nests the child's
  // link/control inside a button: two tab stops, and Enter on the outer one does nothing. Render the
  // styled wrapper as a non-interactive element so the child is the only control.
  const wrapperProps = asChild
    ? ({ render: "div", role: "none", tabIndex: -1, focusable: false, type: undefined } as const)
    : ({ type: "button" } as const);
  return (
    <Button
      {...wrapperProps}
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
