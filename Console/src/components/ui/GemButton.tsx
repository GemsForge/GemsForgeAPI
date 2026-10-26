import type { ComponentProps } from "react";
import { Button } from "tamagui";

export interface GemButtonProps extends ComponentProps<typeof Button> {
  tone?: "primary" | "secondary";
}

/** Shared Tamagui button that preserves native variants while applying Gem Life's semantic tones. */
export function GemButton({ tone = "primary", variant = "outlined", children, ...props }: GemButtonProps) {
  const isQuiet = variant === "quiet";
  return (
    <Button
      type="button"
      {...props}
      variant={variant}
      backgroundColor={isQuiet ? "transparent" : tone === "primary" ? "$gemMint" : "transparent"}
      borderColor={isQuiet ? "transparent" : tone === "primary" ? "$gemMint" : "$gemPanelLight"}
      borderWidth={1}
      color={tone === "primary" ? "$gemCanvas" : "$gemInk"}
    >
      {children}
    </Button>
  );
}
