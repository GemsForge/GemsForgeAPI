import type { ComponentProps } from "react";
import { YStack } from "tamagui";
import { gemElevation } from "../../design-system/tamagui.config";

export interface GemCardProps extends ComponentProps<typeof YStack> {
  interactive?: boolean;
}

/** Shared surface for feature content and records. */
export function GemCard({ interactive = false, children, ...props }: GemCardProps) {
  return (
    <YStack
      {...props}
      gap="$gemControl"
      padding="$wireframePane"
      borderWidth={1}
      borderRadius="$gemCard"
      backgroundColor="$surface"
      borderColor={interactive ? "$action" : "$borderColor"}
      boxShadow={gemElevation.card}
    >
      {children}
    </YStack>
  );
}
