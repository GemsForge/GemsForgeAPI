import type { ComponentProps } from "react";
import { Label, YStack, Input } from "tamagui";

export interface GemFieldProps extends ComponentProps<typeof Input> {
  label: string;
}

/** Shared labelled text field for forms and editors. */
export function GemField({ label, id, ...props }: GemFieldProps) {
  return (
    <YStack gap="$2">
      <Label htmlFor={id} color="$gemMuted" fontSize="$3" fontWeight="700">
        {label}
      </Label>
      <Input
        {...props}
        id={id}
        borderColor="$gemPanelLight"
        color="$gemInk"
        backgroundColor="$gemCanvas"
      />
    </YStack>
  );
}
