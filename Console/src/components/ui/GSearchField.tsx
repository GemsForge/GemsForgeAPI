import type { ComponentProps } from "react";
import { Button, Input, Label, SizableText, YStack } from "tamagui";
import type { GemTextFieldWidth } from "./GemTextField";

/** Search context used to provide the appropriate default semantics and prompt. */
export type GSearchFieldVariant = "address" | "regular";

/** A result rendered below the reusable search input. */
export interface GSearchSuggestion {
  value: string;
  label: string;
}

/** Props for the standard GemsForge search field. */
export interface GSearchFieldProps extends Omit<ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange"> {
  label: string;
  value?: string;
  variant?: GSearchFieldVariant;
  error?: string;
  required?: boolean;
  width?: GemTextFieldWidth;
  onChange?: (value: string) => void;
  suggestions?: GSearchSuggestion[];
  loading?: boolean;
  onSelectSuggestion?: (suggestion: GSearchSuggestion) => void;
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
  suggestions = [],
  loading = false,
  onSelectSuggestion,
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
      {loading && <SizableText role="status">{variant === "address" ? "Searching addresses…" : "Searching…"}</SizableText>}
      {suggestions.length > 0 && (
        <YStack aria-label={`${label} suggestions`} gap="$1">
          {suggestions.map((suggestion) => (
            <Button key={suggestion.value} onPress={() => onSelectSuggestion?.(suggestion)}>{suggestion.label}</Button>
          ))}
        </YStack>
      )}
      {error && <SizableText id={errorID} role="alert" color="$gemDanger" fontSize="$1">{error}</SizableText>}
    </YStack>
  );
}
