import type { ComponentProps } from "react";
import { Label, SizableText, Switch, XStack, YStack } from "tamagui";

/** Props for the shared GemsForge switch wrapper. */
export interface GSwitchProps
  extends Omit<ComponentProps<typeof Switch>, "checked" | "defaultChecked" | "value" | "onCheckedChange" | "onChange"> {
  label: string;
  value?: boolean;
  onChange?: (value: boolean) => void;
}

/** Render a labeled Tamagui switch with a stable project-wide layout contract. */
export function GSwitch({ label, value = false, onChange, id, ...switchProps }: GSwitchProps) {
  const switchID = id ?? `g-switch-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <YStack className="create-form-field" gap="$1">
      <XStack alignItems="center" gap="$2">
        <Switch
          id={switchID}
          {...switchProps}
          size="$3"
          flexShrink={0}
          checked={value}
          onCheckedChange={(checked) => onChange?.(checked === true)}
        >
          <Switch.Thumb animation="quick" />
        </Switch>
        <Label htmlFor={switchID} color="$gemMuted" fontSize="$2" fontWeight="700">
          <SizableText>{label}</SizableText>
        </Label>
      </XStack>
    </YStack>
  );
}
