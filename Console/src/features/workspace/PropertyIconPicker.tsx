import { useMemo, useState } from "react";
import { PROPERTY_ICON_LIBRARY, getPropertyIconByName } from "./propertyIcons";

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
      <input
        className="wireframe-property-icon-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search icons"
        aria-label="Search property icons"
      />
      <div className="wireframe-property-icon-grid" role="radiogroup" aria-label="Matching property icons">
      {filteredIcons.map(({ name, icon: Icon }) => (
        <button
          key={name}
          type="button"
          className={value === name ? "is-selected" : undefined}
          role="radio"
          aria-checked={value === name}
          aria-label={name}
          title={name}
          onClick={() => onChange(name)}
        >
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
        </button>
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
