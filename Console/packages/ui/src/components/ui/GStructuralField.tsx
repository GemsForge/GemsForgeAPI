import { SizableText, Theme, YStack } from "tamagui";
import { GemButton } from "./GemButton";
import { GSearchField } from "./GSearchField";

export type GStructuralFieldKind = "relation" | "lookup";

export interface GStructuralOption {
  value: string;
  label: string;
}

export interface GStructuralFieldProps {
  kind: GStructuralFieldKind;
  label: string;
  search: string;
  options: readonly GStructuralOption[];
  selectedValue?: string;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  nullable?: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (option: GStructuralOption) => void;
  onClear?: () => void;
}

/** Search and choose a linked record, or search records that supply a derived lookup. */
export function GStructuralField({
  kind,
  label,
  search,
  options,
  selectedValue,
  loading = false,
  error,
  emptyMessage = "No matching records.",
  nullable = false,
  onSearchChange,
  onSelect,
  onClear,
}: GStructuralFieldProps) {
  const searchLabel = kind === "relation" ? `Search ${label} records` : `Search records for ${label}`;

  return (
    <Theme name="light">
      <YStack className="g-structural-field" gap="$1" aria-label={`${kind} ${label}`}>
        <GSearchField
          label={searchLabel}
          value={search}
          onChange={onSearchChange}
          loading={loading}
          placeholder={`Search ${label.toLowerCase()}…`}
        />
        {error ? <SizableText role="alert">{error}</SizableText> : null}
        <div className="g-structural-field-options" role="listbox" aria-label={`${label} results`}>
          {options.map((option) => (
            <GemButton
              key={option.value}
              type="button"
              variant={option.value === selectedValue ? "outlined" : "quiet"}
              tone="secondary"
              role="option"
              aria-selected={option.value === selectedValue}
              minHeight="$3"
              width="100%"
              justifyContent="flex-start"
              onPress={() => onSelect(option)}
            >
              <SizableText color="$wireframeInk" fontSize="$2" width="100%" textAlign="left">
                {option.label}
              </SizableText>
            </GemButton>
          ))}
          {!loading && !error && options.length === 0 ? <SizableText>{emptyMessage}</SizableText> : null}
        </div>
        {kind === "relation" && nullable && onClear ? (
          <GemButton type="button" variant="quiet" tone="secondary" onPress={onClear}>
            Clear relation
          </GemButton>
        ) : null}
      </YStack>
    </Theme>
  );
}
