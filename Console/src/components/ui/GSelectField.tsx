import { Select, Label, SizableText, YStack } from "tamagui";
import type { GemTextFieldWidth } from "./GemTextField";

/** A selectable option rendered by the standard single-select field. */
export interface GSelectOption {
  value: string;
  label: string;
}

/** Props for the standard GemsForge single-select field. */
export interface GSelectFieldProps {
  label: string;
  value?: string;
  options: GSelectOption[];
  error?: string;
  required?: boolean;
  width?: GemTextFieldWidth;
  onChange?: (value: string) => void;
}

/** Render the standard Tamagui single-select field for feature-owned values. */
export function GSelectField({
  label,
  value = "",
  options,
  error,
  required = false,
  width = "long",
  onChange,
}: GSelectFieldProps) {
  const id = `g-select-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const errorID = `${id}-error`;

  return (
    <YStack className={`create-form-control create-form-control--${width}`} gap="$1">
      <Label htmlFor={id} color="$gemMuted" fontSize="$2" fontWeight="700">
        {label}{required ? " *" : ""}
      </Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <Select.Trigger id={id} width="100%" aria-invalid={Boolean(error)} aria-describedby={error ? errorID : undefined} aria-required={required}>
          <Select.Value placeholder={`Select ${label.toLowerCase()}…`} />
        </Select.Trigger>
        <Select.Content>
          <Select.Viewport minWidth={240}>
            {options.map((option) => (
              <Select.Item key={option.value} value={option.value}>
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select>
      {error && <SizableText id={errorID} role="alert" color="$gemDanger" fontSize="$1">{error}</SizableText>}
    </YStack>
  );
}
