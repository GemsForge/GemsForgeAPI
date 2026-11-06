import { useId, useState } from "react";
import { Checkbox, Label, SizableText, Theme, XStack, YStack } from "tamagui";
import { GemButton } from "./GemButton";

export type GMultiSelectOption = { value: string; label: string };

export interface GMultiSelectFieldProps {
  label: string;
  value: string;
  options: readonly GMultiSelectOption[];
  onSave: (value: string) => void | Promise<void>;
  onCancel: () => void;
  error?: string;
}

/** Edit semicolon-delimited SQLite TEXT values with a checkbox group. */
export function GMultiSelectField({ label, value, options, onSave, onCancel, error }: GMultiSelectFieldProps) {
  const id = useId();
  const [selected, setSelected] = useState(() => decodeMultiSelectValue(value));
  const [saving, setSaving] = useState(false);
  const visibleOptions = [
    ...options,
    ...selected
      .filter((selectedValue) => !options.some((option) => option.value === selectedValue))
      .map((selectedValue) => ({ value: selectedValue, label: selectedValue })),
  ];

  const toggle = (optionValue: string, checked: boolean) => {
    setSelected((current) =>
      checked
        ? [...current.filter((item) => item !== optionValue), optionValue]
        : current.filter((item) => item !== optionValue),
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(encodeMultiSelectValue(selected));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Theme name="light">
      <YStack className="g-multi-select-field" gap="$2" role="group" aria-label={label}>
        {visibleOptions.map((option, index) => {
          const optionID = `${id}-option-${index}`;
          return (
            <XStack key={option.value} alignItems="center" gap="$2">
              <Checkbox
                id={optionID}
                checked={selected.includes(option.value)}
                disabled={saving}
                onCheckedChange={(next) => toggle(option.value, next === true)}
              >
                <Checkbox.Indicator />
              </Checkbox>
              <Label htmlFor={optionID} cursor="pointer">
                <SizableText>{option.label}</SizableText>
              </Label>
            </XStack>
          );
        })}
        {options.length === 0 ? <SizableText>No choices are configured.</SizableText> : null}
        {error ? <SizableText role="alert">{error}</SizableText> : null}
        <XStack justifyContent="flex-end" gap="$2">
          <GemButton type="button" variant="quiet" tone="secondary" disabled={saving} onPress={onCancel}>
            Cancel
          </GemButton>
          <GemButton type="button" variant="outlined" disabled={saving || options.length === 0} onPress={save}>
            {saving ? "Saving…" : "Save"}
          </GemButton>
        </XStack>
      </YStack>
    </Theme>
  );
}

export function decodeMultiSelectValue(value: string): string[] {
  return [
    ...new Set(
      value
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function encodeMultiSelectValue(values: readonly string[]): string {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))].join(";");
}
