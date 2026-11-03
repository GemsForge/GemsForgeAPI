import { useId, type ComponentProps, type ReactNode } from "react";
import { Select, Label, SizableText, YStack } from "tamagui";
import type { GemTextFieldWidth } from "./GemTextField";
import type { GemColorToken } from "../../presentationTypes";
import type { GemPrimitiveType } from "./primitiveFieldContracts";
import { GemFieldDisplayValue } from "./fieldPrimitives";

const statusPillColors: Record<string, { backgroundColor: string; color: string }> = {
  mint: { backgroundColor: "#78d1bd", color: "#06231e" },
  gold: { backgroundColor: "#f0bd73", color: "#2b1c08" },
  blue: { backgroundColor: "#2f6fae", color: "#eaf3ff" },
  green: { backgroundColor: "#367a52", color: "#e9fff0" },
  purple: { backgroundColor: "#76549a", color: "#f3eaff" },
  orange: { backgroundColor: "#e49a43", color: "#2b1708" },
  red: { backgroundColor: "#ad4d46", color: "#fff0ed" },
  gray: { backgroundColor: "#29434a", color: "#edf4f4" },
};

/** A selectable option rendered by the standard single-select field. */
export interface GSelectOption {
  value: string;
  label: string;
  /** Chooses the live display state or the interactive select state. */
  editing?: boolean;
  displayValue?: ReactNode;
  onDisplayClick?: () => void;
  colorToken?: GemColorToken;
  isDefault?: boolean;
  group?: string;
}

/** Props for the standard GemsForge single-select field. */
export interface GSelectFieldProps extends Omit<
  ComponentProps<typeof Select.Trigger>,
  "value" | "onValueChange" | "onChange"
> {
  label: string;
  showLabel?: boolean;
  editing?: boolean;
  displayValue?: ReactNode;
  onDisplayClick?: () => void;
  value?: string;
  options: GSelectOption[];
  error?: string;
  required?: boolean;
  width?: GemTextFieldWidth;
  containerClassName?: string;
  onChange?: (value: string) => void;
  primitive?: Extract<GemPrimitiveType, "select" | "status">;
  /** Marks portaled menu content that belongs to the light wireframe surface. */
  wireframe?: boolean;
}

/** Render the standard Tamagui single-select field for feature-owned values. */
export function GSelectField({
  label,
  showLabel = true,
  editing = true,
  displayValue,
  onDisplayClick,
  value = "",
  options,
  error,
  required = false,
  width = "long",
  id: providedID,
  containerClassName,
  onChange,
  primitive,
  wireframe = false,
  ...triggerProps
}: GSelectFieldProps) {
  const { className: triggerClassName, ...selectTriggerProps } = triggerProps;
  const instanceID = useId();
  const id = providedID ?? `g-select-${instanceID}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const errorID = `${id}-error`;
  const selectedOption = options.find((option) => option.value === value);
  const optionGroups = options.reduce<Array<{ label?: string; options: GSelectOption[] }>>((groups, option) => {
    const current = groups[groups.length - 1];
    if (current && current.label === option.group) {
      current.options.push(option);
    } else {
      groups.push({ label: option.group, options: [option] });
    }
    return groups;
  }, []);

  if (!editing) {
    return (
      <YStack className="gem-field-display" gap="$1">
        <Label
          id={`${id}-display-label`}
          className={showLabel ? "g-field-label" : "sr-only"}
          color="$gemGold"
          fontSize="$2"
          fontWeight="800"
          textTransform="uppercase"
        >
          {label}
        </Label>
        <GemFieldDisplayValue
          aria-describedby={`${id}-display-label`}
          onClick={onDisplayClick}
          aria-invalid={Boolean(error)}
        >
          {displayValue ?? options.find((option) => option.value === value)?.label ?? "—"}
        </GemFieldDisplayValue>
        {error && (
          <SizableText role="alert" color="$gemDanger" fontSize="$1">
            {error}
          </SizableText>
        )}
      </YStack>
    );
  }

  return (
    <YStack className={`create-form-field${containerClassName ? ` ${containerClassName}` : ""}`} gap="$1">
      {showLabel ? (
        <Label
          className="g-field-label"
          htmlFor={id}
          color="$gemGold"
          fontSize="$2"
          fontWeight="800"
          textTransform="uppercase"
        >
          {label}
          {required ? " *" : ""}
        </Label>
      ) : null}
      <Select value={value || undefined} onValueChange={onChange} zIndex={100}>
        <Select.Trigger
          {...selectTriggerProps}
          id={id}
          className={[
            "create-form-control",
            `create-form-control--${width}`,
            primitive === "status" ? "g-status-select-trigger" : "",
            triggerClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          width="100%"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorID : undefined}
          aria-required={required}
          aria-label={showLabel ? undefined : label}
        >
          {primitive === "status" && selectedOption ? (
            <SizableText
              className={
                selectedOption.colorToken
                  ? `primitive-status-pill primitive-status-pill--${selectedOption.colorToken}`
                  : "primitive-status-pill"
              }
              {...(selectedOption.colorToken ? statusPillColors[selectedOption.colorToken] : {})}
            >
              {selectedOption.label}
            </SizableText>
          ) : (
            <Select.Value
              placeholder={`Select ${label.toLowerCase()}…`}
              fontSize={wireframe ? "$2" : undefined}
              lineHeight={wireframe ? "$2" : undefined}
            />
          )}
        </Select.Trigger>
        <Select.Content>
          <Select.Viewport
            className="gem-select-content"
            data-gem-select-content="true"
            data-status-select={primitive === "status" ? "true" : undefined}
            data-wireframe-select={wireframe ? "true" : undefined}
            backgroundColor="$fieldMenuBackground"
            borderColor="$fieldBorder"
            borderWidth={1}
            color="$fieldMenuText"
            borderRadius="$2"
            minWidth={240}
            maxHeight={320}
            padding="$1"
          >
            {optionGroups.map((group, groupIndex) => (
              <Select.Group key={group.label ?? `ungrouped-${groupIndex}`}>
                {group.label && <Select.Label className="g-select-option-group-label">{group.label}</Select.Label>}
                {group.options.map((option) => (
                  <Select.Item
                    key={option.value}
                    className="gem-select-item"
                    value={option.value}
                    color="$fieldMenuText"
                    borderRadius="$2"
                    minHeight="$4"
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                  >
                    <Select.ItemText
                      color="$fieldMenuText"
                      fontSize={wireframe ? "$2" : "$1"}
                      lineHeight={wireframe ? "$2" : "$1"}
                    >
                      {option.label}
                    </Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Group>
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
