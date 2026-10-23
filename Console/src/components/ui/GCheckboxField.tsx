import { Checkbox, Label, SizableText, XStack, YStack } from "tamagui";
import type { GemTextFieldWidth } from "./GemTextField";

/** Props for the standard GemsForge boolean checkbox field. */
export interface GCheckboxFieldProps {
  label: string;
  value?: boolean;
  error?: string;
  required?: boolean;
  width?: GemTextFieldWidth;
  onChange?: (value: boolean) => void;
}

/** Render the standard Tamagui checkbox field for a feature-owned boolean value. */
export function GCheckboxField({
  label,
  value = false,
  error,
  required = false,
  width = "long",
  onChange,
}: GCheckboxFieldProps) {
  const id = `g-checkbox-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const errorID = `${id}-error`;

  return (
    <YStack className={`create-form-control create-form-control--${width}`} gap="$1">
      <XStack alignItems="center" gap="$2">
        <Checkbox
          id={id}
          checked={value}
          onCheckedChange={(checked) => onChange?.(checked === true)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorID : undefined}
          aria-required={required}
        >
          <Checkbox.Indicator />
        </Checkbox>
        <Label htmlFor={id} color="$gemMuted" fontSize="$2" fontWeight="700">
          {label}{required ? " *" : ""}
        </Label>
      </XStack>
      {error && <SizableText id={errorID} role="alert" color="$gemDanger" fontSize="$1">{error}</SizableText>}
    </YStack>
  );
}
