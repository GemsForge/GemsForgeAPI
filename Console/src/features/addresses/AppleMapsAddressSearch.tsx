import { useEffect, useState } from "react";

export interface AppleMapsPlace {
  fullThoroughfare?: string | null;
  subThoroughfare?: string | null;
  thoroughfare?: string | null;
  locality?: string | null;
  administrativeArea?: string | null;
  administrativeAreaCode?: string | null;
  postCode?: string | null;
  country?: string | null;
  countryCode?: string | null;
}

export interface AppleMapsSuggestion extends AppleMapsPlace {
  displayLines: string[];
}

export interface AppleMapsSearchClient {
  autocomplete: (
    query: string,
    options?: { signal?: AbortSignal; includeAddresses?: boolean; includePointsOfInterest?: boolean },
  ) => Promise<{ results: AppleMapsSuggestion[] }>;
  search: (
    suggestion: AppleMapsSuggestion,
    options?: { signal?: AbortSignal },
  ) => Promise<{ places: AppleMapsPlace[] }>;
}

interface AppleMapKitGlobal {
  init: (options: { authorizationCallback: (done: (token: string) => void) => void; language?: string }) => void;
  Search: new (options?: { includeAddresses?: boolean; includePointsOfInterest?: boolean }) => AppleMapsSearchClient;
}

declare global {
  interface Window {
    mapkit?: AppleMapKitGlobal;
  }
}

let mapKitPromise: Promise<AppleMapKitGlobal> | null = null;
let initializedToken: string | null = null;

async function loadMapKit(token: string): Promise<AppleMapKitGlobal> {
  if (!window.mapkit) {
    mapKitPromise ??= new Promise<AppleMapKitGlobal>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => {
        if (window.mapkit) resolve(window.mapkit);
        else reject(new Error("Apple Maps loaded without its search library."));
      };
      script.onerror = () => {
        mapKitPromise = null;
        reject(new Error("Apple Maps could not be loaded. Check your connection and try again."));
      };
      document.head.append(script);
    });
    await mapKitPromise;
  }

  const mapkit = window.mapkit;
  if (!mapkit) throw new Error("Apple Maps is unavailable.");
  if (initializedToken !== token) {
    mapkit.init({
      authorizationCallback: (done) => done(token),
      language: navigator.language || "en-US",
    });
    initializedToken = token;
  }
  return mapkit;
}

export async function createAppleMapsSearchClient(
  token = import.meta.env.VITE_MAPKIT_JS_TOKEN,
): Promise<AppleMapsSearchClient> {
  const normalizedToken = token?.trim();
  if (!normalizedToken) throw new Error("Apple Maps search needs a MapKit JS token.");
  const mapkit = await loadMapKit(normalizedToken);
  return new mapkit.Search({ includeAddresses: true, includePointsOfInterest: true });
}

export type AddressSearchValues = {
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export function addressValuesFromApplePlace(place: AppleMapsPlace): AddressSearchValues {
  const addressLine1 =
    place.fullThoroughfare?.trim() ||
    [place.subThoroughfare, place.thoroughfare]
      .filter((part) => part?.trim())
      .join(" ")
      .trim();
  return {
    ...(addressLine1 ? { addressLine1 } : {}),
    ...(place.locality?.trim() ? { city: place.locality.trim() } : {}),
    ...((place.administrativeAreaCode || place.administrativeArea)?.trim()
      ? { state: (place.administrativeAreaCode || place.administrativeArea)!.trim() }
      : {}),
    ...(place.postCode?.trim() ? { postalCode: place.postCode.trim() } : {}),
    ...((place.countryCode || place.country)?.trim() ? { country: (place.countryCode || place.country)!.trim() } : {}),
  };
}

export function AppleMapsAddressSearch({
  onSelect,
  client,
}: {
  onSelect: (values: AddressSearchValues) => void;
  client?: AppleMapsSearchClient;
}) {
  const token = import.meta.env.VITE_MAPKIT_JS_TOKEN?.trim();
  const enabled = Boolean(client || token);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AppleMapsSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const value = query.trim();
    if (!enabled || value.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const search = client ?? (await createAppleMapsSearchClient(token));
        const response = await search.autocomplete(value, {
          signal: controller.signal,
          includeAddresses: true,
          includePointsOfInterest: true,
        });
        if (active) {
          setSuggestions(response.results);
          setMessage(response.results.length ? null : "No Apple Maps matches found.");
        }
      } catch (cause) {
        if (active && !(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(cause instanceof Error ? cause.message : "Apple Maps search failed.");
          setSuggestions([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [client, enabled, query, token]);

  async function choose(suggestion: AppleMapsSuggestion) {
    setSelecting(true);
    setError(null);
    try {
      const search = client ?? (await createAppleMapsSearchClient(token));
      const response = await search.search(suggestion);
      const place = response.places[0] ?? suggestion;
      onSelect(addressValuesFromApplePlace(place));
      setQuery(suggestion.displayLines.join(", "));
      setSuggestions([]);
      setMessage("Address details filled from Apple Maps. Review the fields before saving.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load that Apple Maps result.");
    } finally {
      setSelecting(false);
    }
  }

  return (
    <section className="address-search-section" aria-label="Apple Maps address search">
      <h4>Find an address with Apple Maps</h4>
      {!enabled && (
        <p className="muted">
          Configure <code>VITE_MAPKIT_JS_TOKEN</code> in <code>Console/.env.local</code> to enable Apple Maps search.
          You can still enter the address manually.
        </p>
      )}
      <label htmlFor="apple-maps-address-search">
        Search places or addresses
        <input
          id="apple-maps-address-search"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Start typing an address or place"
          disabled={!enabled || selecting}
        />
      </label>
      {loading && (
        <p role="status" id="apple-maps-search-loading">
          Searching Apple Maps…
        </p>
      )}
      {suggestions.length > 0 && (
        <ul className="address-search-results" aria-label="Apple Maps results">
          {suggestions.map((suggestion, index) => {
            const label = suggestion.displayLines.filter(Boolean).join(", ");
            return (
              <li key={`${label}-${index}`}>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={selecting}
                  onClick={() => void choose(suggestion)}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" id="apple-maps-search-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" id="apple-maps-search-message">
          {message}
        </p>
      )}
    </section>
  );
}
