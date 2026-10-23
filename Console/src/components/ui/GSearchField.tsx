import type { ComponentProps } from "react";
import { Input, Label, SizableText, YStack } from "tamagui";
import type { GemTextFieldWidth } from "./GemTextField";

/** Search context used to provide the appropriate default semantics and prompt. */
export type GSearchFieldVariant = "address" | "regular";

/** Props for the standard GemsForge search field. */
export interface GSearchFieldProps extends Omit<ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange"> {
  label: string;
  value?: string;
  variant?: GSearchFieldVariant;
  error?: string;
  required?: boolean;
  width?: GemTextFieldWidth;
  onChange?: (value: string) => void;
}

/** Render the standard Tamagui search field for address and regular search workflows. */
export function GSearchField({
  label,
  value = "",
  variant = "regular",
  error,
  required = false,
  width = "long",
  onChange,
  placeholder,
  ...inputProps
}: GSearchFieldProps) {
  const id = `g-search-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const errorID = `${id}-error`;
  const defaultPlaceholder = variant === "address" ? "Search for an address…" : `Search ${label.toLowerCase()}…`;

  return (
    <YStack className={`create-form-control create-form-control--${width}`} gap="$1">
      <Label htmlFor={id} color="$gemMuted" fontSize="$2" fontWeight="700">
        {label}{required ? " *" : ""}
      </Label>
      <Input
        {...inputProps}
        id={id}
        type="search"
        value={value}
        placeholder={placeholder ?? defaultPlaceholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorID : undefined}
        aria-required={required}
        onChange={(event) => onChange?.(event.currentTarget.value)}
      />
      {error && <SizableText id={errorID} role="alert" color="$gemDanger" fontSize="$1">{error}</SizableText>}
    </YStack>
  );
}
