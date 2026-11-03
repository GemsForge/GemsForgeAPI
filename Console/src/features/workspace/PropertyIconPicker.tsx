import { useMemo, useState } from "react";
import { PROPERTY_ICON_LIBRARY, getPropertyIconByName } from "./propertyIcons";
import { GemButton } from "@gemsforge/ui";
import { GemTextField } from "@gemsforge/ui";

export function PropertyIconPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const filteredIcons = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return PROPERTY_ICON_LIBRARY;
    return PROPERTY_ICON_LIBRARY.filter(({ name, keywords }) =>
      [name, ...keywords].some((term) => term.toLowerCase().includes(normalizedQuery)),
    );
  }, [query]);

  return (
    <div className="wireframe-property-icon-picker" aria-label="Property icon catalog">
      <GemTextField
        className="wireframe-property-icon-search"
        label="Search property icons"
        showLabel={false}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder="Search icons"
      />
      <div className="wireframe-property-icon-grid" role="radiogroup" aria-label="Matching property icons">
      {filteredIcons.map(({ name, icon: Icon }) => (
        <GemButton
          key={name}
          type="button"
          className={value === name ? "is-selected" : undefined}
          size="xs"
          variant="quiet"
          tone="secondary"
          role="radio"
          aria-checked={value === name}
          aria-label={name}
          onClick={() => onChange(name)}
        >
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
        </GemButton>
      ))}
      </div>
      {filteredIcons.length === 0 ? <p className="wireframe-property-icon-empty">No matching icons.</p> : null}
    </div>
  );
}

export function PropertyIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = getPropertyIconByName(name).icon;
  return <Icon size={size} strokeWidth={2} aria-hidden="true" />;
}
