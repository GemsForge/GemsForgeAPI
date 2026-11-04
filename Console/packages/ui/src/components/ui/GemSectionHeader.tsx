import type { ReactNode } from "react";
import { XStack, YStack } from "tamagui";
import { GemBody, GemSectionHeading } from "./GemTypography";

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
        <GemSectionHeading marginBottom="$1">{title}</GemSectionHeading>
        {description ? <GemBody className="muted">{description}</GemBody> : null}
      </YStack>
      {trailing}
    </XStack>
  );
}
