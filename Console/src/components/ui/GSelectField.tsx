import { useId, type ComponentProps, type ReactNode } from "react";
import { Select, Label, SizableText, YStack } from "tamagui";
import type { GemTextFieldWidth } from "./GemTextField";
import type { RecordColorToken } from "../../table-kit/recordContracts";
import type { GemPrimitiveType } from "./primitiveFieldContracts";

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
  colorToken?: RecordColorToken;
  isDefault?: boolean;
  group?: string;
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
  primitive?: Extract<GemPrimitiveType, "select" | "status">;
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
  primitive,
  ...triggerProps
}: GSelectFieldProps) {
  const instanceID = useId();
  const id = `g-select-${instanceID}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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
        <Label className="g-field-label" color="$gemGold" fontSize="$2" fontWeight="800" textTransform="uppercase">
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
      <Label className="g-field-label" htmlFor={id} color="$gemGold" fontSize="$2" fontWeight="800" textTransform="uppercase">
        {label}
        {required ? " *" : ""}
      </Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <Select.Trigger
          {...triggerProps}
          id={id}
          className={`create-form-control create-form-control--${width}${primitive === "status" ? " g-status-select-trigger" : ""}`}
          width="100%"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorID : undefined}
          aria-required={required}
        >
          {primitive === "status" && selectedOption ? (
            <SizableText
              className={selectedOption.colorToken ? `primitive-status-pill primitive-status-pill--${selectedOption.colorToken}` : "primitive-status-pill"}
              {...(selectedOption.colorToken ? statusPillColors[selectedOption.colorToken] : {})}
            >
              {selectedOption.label}
            </SizableText>
          ) : (
            <Select.Value placeholder={`Select ${label.toLowerCase()}…`} />
          )}
        </Select.Trigger>
        <Select.Content
          className={`gem-select-content${primitive === "status" ? " g-status-select-content" : ""}`}
          backgroundColor="$gemPanel"
          borderColor="$gemPanelLight"
          borderWidth={1}
          color="$gemInk"
          zIndex={100}
          elevate
        >
          <Select.Viewport minWidth={240} maxHeight={320} padding="$1">
            {optionGroups.map((group, groupIndex) => (
              <Select.Group key={group.label ?? `ungrouped-${groupIndex}`}>
                {group.label && <Select.Label className="g-select-option-group-label">{group.label}</Select.Label>}
                {group.options.map((option, optionIndex) => (
                  <Select.Item
                    key={option.value}
                    index={optionGroups.slice(0, groupIndex).reduce((total, previousGroup) => total + previousGroup.options.length, 0) + optionIndex}
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
                      <span className={option.colorToken ? `select-option-pill select-option-pill--${option.colorToken}` : undefined}>
                        {option.label}
                      </span>
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
