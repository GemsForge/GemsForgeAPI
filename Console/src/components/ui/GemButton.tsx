import type { ComponentProps } from "react";
import { Button } from "tamagui";

export interface GemButtonProps extends ComponentProps<typeof Button> {
  tone?: "primary" | "secondary";
}

/** Shared action button with Gem Life's semantic visual tones. */
export function GemButton({ tone = "primary", children, ...props }: GemButtonProps) {
  return (
    <Button
      {...props}
      backgroundColor={tone === "primary" ? "$gemMint" : "transparent"}
      borderColor={tone === "primary" ? "$gemMint" : "$gemPanelLight"}
      borderWidth={1}
      color={tone === "primary" ? "$gemCanvas" : "$gemInk"}
    >
      {children}
    </Button>
  );
}
