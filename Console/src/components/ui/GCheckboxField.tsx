import { useId, type ComponentProps } from "react";
import { Checkbox, Label, SizableText, XStack, YStack } from "tamagui";
import type { GemTextFieldWidth } from "./GemTextField";

/** Props for the standard GemsForge boolean checkbox field. */
export interface GCheckboxFieldProps extends Omit<
  ComponentProps<typeof Checkbox>,
  "checked" | "value" | "onCheckedChange" | "onChange"
> {
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
  const instanceID = useId();
  const id = `g-checkbox-${instanceID}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const errorID = `${id}-error`;

  return (
    <YStack className="create-form-field" gap="$1">
      <XStack alignItems="center" gap="$2">
        <Checkbox
          id={id}
          {...checkboxProps}
          className={`field-checkbox create-form-control--${width}`}
          size="$2"
          width="$2"
          height="$2"
          minWidth="$2"
          minHeight="$2"
          checked={value}
          onCheckedChange={(checked) => onChange?.(checked === true)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorID : undefined}
          aria-required={required}
        >
          <Checkbox.Indicator />
        </Checkbox>
        <Label className="g-field-label" htmlFor={id} color="$gemGold" fontSize="$2" fontWeight="800" textTransform="uppercase">
          {label}
          {required ? " *" : ""}
        </Label>
      </XStack>
      {error && (
        <SizableText id={errorID} role="alert" color="$gemDanger" fontSize="$1">
          {error}
        </SizableText>
      )}
    </YStack>
  );
}
