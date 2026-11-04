import type { ComponentProps } from "react";
import { Button } from "tamagui";

export interface GemButtonProps extends ComponentProps<typeof Button> {
  tone?: "primary" | "secondary" | "wireframe";
}

/** Shared Tamagui button that preserves native variants while applying Gem Life's semantic tones. */
export function GemButton({ tone = "primary", variant = "outlined", children, ...props }: GemButtonProps) {
  const isQuiet = variant === "quiet";
  const isWireframe = tone === "wireframe";
  return (
    <Button
      type="button"
      {...props}
      variant={variant}
      backgroundColor={
        isQuiet ? "transparent" : isWireframe ? "$wireframePanel" : tone === "primary" ? "$gemMint" : "transparent"
      }
      borderColor={
        isQuiet ? "transparent" : isWireframe ? "$wireframeLine" : tone === "primary" ? "$gemMint" : "$borderColor"
      }
      borderWidth={1}
      borderRadius={isWireframe ? "$wireframeControl" : undefined}
      color={isWireframe ? "$wireframeInk" : tone === "primary" ? "$gemCanvas" : "$color"}
    >
      {children}
    </Button>
  );
}
