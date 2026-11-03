import { YStack } from "tamagui";
import { GemBody } from "./GemTypography";

export interface GemLoadingStateProps {
  label?: string;
}

/** Shared loading state for API-backed feature screens. */
export function GemLoadingState({ label = "Loading…" }: GemLoadingStateProps) {
  return (
    <YStack className="empty-state" role="status" aria-live="polite">
      <GemBody>{label}</GemBody>
    </YStack>
  );
}
