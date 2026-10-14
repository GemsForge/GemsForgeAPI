import type { ReactNode } from "react";
import { XStack, YStack } from "tamagui";

export interface GemSectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
}

/** Shared page heading that keeps feature screens visually consistent. */
export function GemSectionHeader({ eyebrow, title, description, trailing }: GemSectionHeaderProps) {
  return (
    <XStack className="content-heading" justifyContent="space-between" alignItems="flex-end" gap="$4">
      <YStack>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p className="muted">{description}</p> : null}
      </YStack>
      {trailing}
    </XStack>
  );
}
