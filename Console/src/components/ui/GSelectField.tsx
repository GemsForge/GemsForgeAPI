import type { ComponentProps, ReactNode } from "react";
import { Select, Label, SizableText, YStack } from "tamagui";
import type { GemTextFieldWidth } from "./GemTextField";

/** A selectable option rendered by the standard single-select field. */
export interface GSelectOption {
  value: string;
  label: string;
  /** Chooses the live display state or the interactive select state. */
  editing?: boolean;
  displayValue?: ReactNode;
  onDisplayClick?: () => void;
}

/** Props for the standard GemsForge single-select field. */
export interface GSelectFieldProps extends Omit<
  ComponentProps<typeof Select.Trigger>,
  "value" | "onValueChange" | "onChange"
> {
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
  editing = true,
  displayValue,
  onDisplayClick,
  value = "",
  options,
  error,
  required = false,
  width = "long",
  onChange,
  ...triggerProps
}: GSelectFieldProps) {
  const id = `g-select-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const errorID = `${id}-error`;

  if (!editing) {
    return (
      <YStack className="gem-field-display" gap="$1">
        <Label color="$gemGold" fontSize="$2" fontWeight="800" textTransform="uppercase">
          {label}
        </Label>
        <button type="button" className="gem-field-display-value" onClick={onDisplayClick}>
          {displayValue ?? options.find((option) => option.value === value)?.label ?? "—"}
        </button>
      </YStack>
    );
  }

  return (
    <YStack className="create-form-field" gap="$1">
      <Label htmlFor={id} color="$gemGold" fontSize="$2" fontWeight="800" textTransform="uppercase">
        {label}
        {required ? " *" : ""}
      </Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <Select.Trigger
          {...triggerProps}
          id={id}
          className={`create-form-control create-form-control--${width}`}
          width="100%"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorID : undefined}
          aria-required={required}
        >
          <Select.Value placeholder={`Select ${label.toLowerCase()}…`} />
        </Select.Trigger>
        <Select.Content
          className="gem-select-content"
          backgroundColor="$gemPanel"
          borderColor="$gemPanelLight"
          borderWidth={1}
          color="$gemInk"
          zIndex={100}
          elevate
        >
          <Select.Viewport minWidth={240} maxHeight={320} padding="$1">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                color="$gemInk"
                borderRadius="$2"
                minHeight="$4"
                paddingHorizontal="$2"
                paddingVertical="$1"
                hoverStyle={{ backgroundColor: "$gemPanelLight" }}
                focusStyle={{ backgroundColor: "$gemPanelLight" }}
              >
                <Select.ItemText color="$gemInk" fontSize="$3">
                  {option.label}
                </Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select>
      {error && (
        <SizableText id={errorID} role="alert" color="$gemDanger" fontSize="$1">
          {error}
        </SizableText>
      )}
    </YStack>
  );
}
