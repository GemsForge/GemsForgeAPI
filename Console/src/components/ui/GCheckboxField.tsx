import type { ComponentProps } from "react";
import { Checkbox, Label, SizableText, XStack, YStack } from "tamagui";
import type { GemTextFieldWidth } from "./GemTextField";

/** Props for the standard GemsForge boolean checkbox field. */
export interface GCheckboxFieldProps extends Omit<ComponentProps<typeof Checkbox>, "checked" | "value" | "onCheckedChange" | "onChange"> {
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
  ...checkboxProps
}: GCheckboxFieldProps) {
  const id = `g-checkbox-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const errorID = `${id}-error`;

  return (
    <YStack className="create-form-field" gap="$1">
      <XStack alignItems="center" gap="$2">
        <Checkbox
          id={id}
          {...checkboxProps}
          className={`field-checkbox create-form-control--${width}`}
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
