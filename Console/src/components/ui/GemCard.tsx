import type { ComponentProps } from "react";
import { YStack } from "tamagui";

export interface GemCardProps extends ComponentProps<typeof YStack> {
  interactive?: boolean;
}

/** Shared surface for feature content and records. */
export function GemCard({ interactive = false, children, ...props }: GemCardProps) {
  return (
    <YStack
      {...props}
      gap="$3"
      padding="$4"
      borderWidth={1}
      borderRadius="$4"
      backgroundColor="$gemPanel"
      borderColor={interactive ? "$gemMint" : "$gemPanelLight"}
    >
      {children}
    </YStack>
  );
}
