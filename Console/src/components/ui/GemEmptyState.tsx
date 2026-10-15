import type { ReactNode } from "react";
import { YStack } from "tamagui";

export interface GemEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
}

/** Shared empty, unavailable, and not-yet-configured state. */
export function GemEmptyState({ icon = "⌁", title, description }: GemEmptyStateProps) {
  return (
    <YStack className="empty-state" alignItems="center" gap="$2">
      <span className="empty-icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </YStack>
  );
}
