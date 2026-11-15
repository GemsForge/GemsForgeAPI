/**
 * The one source of truth for which life domain a built-in collection belongs to and the gem hue
 * that identifies it. The sidebar groups collections by `domain`, and collection pages, records,
 * and the inspector use `hue` for the domain bar, breadcrumb dot, and cover accents.
 */
export type CollectionDomain = { domain: string; hue: string };

export const collectionDomains = {
  "Gem Hues": { domain: "Personal", hue: "#A33B4A" },
  Education: { domain: "Learning", hue: "#7650A8" },
  Employment: { domain: "Career", hue: "#2F5FA8" },
  Addresses: { domain: "Home", hue: "#5C8A26" },
  "Expense Tracker": { domain: "Money", hue: "#A9771C" },
  Services: { domain: "Services", hue: "#237F8E" },
} as const satisfies Record<string, CollectionDomain>;

export type BuiltInCollection = keyof typeof collectionDomains;

/** Sidebar section for schema-builder tables, which have no domain yet. */
export const customCollectionDomain = "Custom tables";

/** Spread into a collection view config: `...domainConfigFor("Education")`. */
export function domainConfigFor(collection: BuiltInCollection) {
  const { domain, hue } = collectionDomains[collection];
  return { domainLabel: domain, domainHue: hue };
}
