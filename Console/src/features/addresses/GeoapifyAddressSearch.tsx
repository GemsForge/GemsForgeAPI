import { useEffect, useState } from "react";

export interface GeoapifyAddress {
  address_line1?: string;
  address_line2?: string;
  housenumber?: string;
  street?: string;
  city?: string;
  state?: string;
  state_code?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  formatted?: string;
  datasource?: { attribution?: string };
}

export interface GeoapifySuggestion {
  properties: GeoapifyAddress;
}

export interface GeoapifySearchClient {
  autocomplete: (query: string, signal?: AbortSignal) => Promise<GeoapifySuggestion[]>;
}

export type AddressSearchValues = {
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export function addressValuesFromGeoapify(properties: GeoapifyAddress): AddressSearchValues {
  const streetAddress = [properties.housenumber, properties.street].filter(Boolean).join(" ").trim();
  const addressLine1 = properties.address_line1?.trim() || streetAddress;
  const state = properties.state_code?.trim() || properties.state?.trim();
  const country = properties.country_code?.trim().toUpperCase() || properties.country?.trim();

  return {
    ...(addressLine1 ? { addressLine1 } : {}),
    ...(properties.city?.trim() ? { city: properties.city.trim() } : {}),
    ...(state ? { state } : {}),
    ...(properties.postcode?.trim() ? { postalCode: properties.postcode.trim() } : {}),
    ...(country ? { country } : {}),
  };
}

export function createGeoapifySearchClient(
  apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY,
  request: typeof fetch = fetch,
): GeoapifySearchClient {
  const normalizedKey = apiKey?.trim();
  if (!normalizedKey) throw new Error("Address search needs a Geoapify API key.");

  return {
    async autocomplete(query, signal) {
      const params = new URLSearchParams({ text: query, format: "json", limit: "5", apiKey: normalizedKey });
      const response = await request(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`, { signal });
      if (response.status === 429) {
        throw new Error("Address search has reached its request limit. You can still enter the address manually.");
      }
      if (!response.ok)
        throw new Error("Address search is temporarily unavailable. You can enter the address manually.");

      const payload = (await response.json()) as { results?: GeoapifySuggestion[] };
      return Array.isArray(payload.results) ? payload.results : [];
    },
  };
}

function suggestionLabel(suggestion: GeoapifySuggestion): string {
  const { properties } = suggestion;
  return (
    properties.formatted ||
    properties.address_line1 ||
    [properties.housenumber, properties.street, properties.city].filter(Boolean).join(" ")
  );
}

export function GeoapifyAddressSearch({
  onSelect,
  client,
}: {
  onSelect: (values: AddressSearchValues) => void;
  client?: GeoapifySearchClient;
}) {
  const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY?.trim();
  const enabled = Boolean(client || apiKey);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoapifySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  useEffect(() => {
    const value = query.trim();
    if (!enabled || value.length < 3 || value === selectedLabel) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      setHasSearched(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setHasSearched(false);
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const search = client ?? createGeoapifySearchClient(apiKey);
        const results = await search.autocomplete(value, controller.signal);
        if (active) {
          setSuggestions(results);
          setHasSearched(true);
        }
      } catch (cause) {
        if (active && !(cause instanceof DOMException && cause.name === "AbortError")) {
          setSuggestions([]);
          setError(
            cause instanceof Error ? cause.message : "Address search failed. You can enter the address manually.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [apiKey, client, enabled, query, selectedLabel]);

  function choose(suggestion: GeoapifySuggestion) {
    onSelect(addressValuesFromGeoapify(suggestion.properties));
    const label = suggestionLabel(suggestion);
    setSelectedLabel(label);
    setQuery(label);
    setSuggestions([]);
  }

  function changeQuery(value: string) {
    setSelectedLabel(null);
    setQuery(value);
  }

  const resultAttributions = [
    ...new Set(suggestions.map((item) => item.properties.datasource?.attribution).filter(Boolean)),
  ];

  return (
    <section className="address-search-section" aria-label="Address search">
      <h4>Find an address</h4>
      {!enabled && (
        <p className="muted">
          Configure <code>VITE_GEOAPIFY_API_KEY</code> in <code>Console/.env.local</code> to enable address search. You
          can still enter the address manually.
        </p>
      )}
      <label htmlFor="geoapify-address-search">
        Search places or addresses
        <input
          id="geoapify-address-search"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => changeQuery(event.currentTarget.value)}
          placeholder="Start typing an address or place"
          disabled={!enabled}
        />
      </label>
      {loading && <p role="status">Searching addresses…</p>}
      {suggestions.length > 0 && (
        <ul className="address-search-results" aria-label="Address suggestions">
          {suggestions.map((suggestion, index) => {
            const label = suggestionLabel(suggestion);
            return (
              <li key={`${label}-${index}`}>
                <button type="button" className="secondary-button" onClick={() => choose(suggestion)}>
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p role="alert">{error}</p>}
      {hasSearched && !loading && !error && suggestions.length === 0 && (
        <p role="status">No address matches found. You can enter the address manually.</p>
      )}
      <p className="address-search-attribution">
        <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">
          Powered by Geoapify
        </a>
        {" · "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap contributors
        </a>
        {resultAttributions.map((attribution) => (
          <span key={attribution}> · {attribution}</span>
        ))}
      </p>
    </section>
  );
}
