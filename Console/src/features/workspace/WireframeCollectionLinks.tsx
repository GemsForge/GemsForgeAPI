import React, { useEffect, useState } from "react";
import { Text } from "tamagui";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { GemButton } from "@gemsforge/ui";
import { useTableNavigationPreferences } from "../../data/presentationQueries";
import { useSchemaPageTablesQuery } from "../../data/workflowQueries";
import { getPropertyIconByName } from "./propertyIcons";
import { collectionDomains, customCollectionDomain, type BuiltInCollection } from "./collectionDomains";

const builtInCollections: ReadonlyArray<{ label: BuiltInCollection; tableName: string; to: string }> = [
  { label: "Gem Hues", tableName: "GemHues", to: "/gemhues" },
  { label: "Education", tableName: "Education", to: "/education" },
  { label: "Employment", tableName: "Employment", to: "/employment" },
  { label: "Addresses", tableName: "Addresses", to: "/addresses" },
  { label: "Expense Tracker", tableName: "ExpenseTransaction", to: "/transactions" },
  { label: "Services", tableName: "Services", to: "/service-accounts" },
];
const collections = builtInCollections.map((item) => ({ ...item, ...collectionDomains[item.label] }));

const collapsedDomainsKey = "gemsforge:sidebar-collapsed-domains";

function readCollapsedDomains(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(collapsedDomainsKey) ?? "[]");
    return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

/** Domain sections stay collapsed across visits; storage failures fall back to all expanded. */
function useCollapsedDomains() {
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsedDomains);
  useEffect(() => {
    try {
      window.localStorage.setItem(collapsedDomainsKey, JSON.stringify(collapsed));
    } catch {
      // Private browsing or blocked storage: keep the in-memory state only.
    }
  }, [collapsed]);
  const toggle = (domain: string) =>
    setCollapsed((current) => (current.includes(domain) ? current.filter((d) => d !== domain) : [...current, domain]));
  return { collapsed, toggle };
}

type WireframeCollectionLinksProps = {
  activeCollection: string;
  activeCollectionTitle?: string;
  recordCount: number;
  counts: Record<string, number | undefined>;
  search: string;
  activeCollectionIcon?: ReactNode;
  recordsByCollection: Record<string, readonly unknown[]>;
};

export function WireframeCollectionLinks({
  activeCollection,
  activeCollectionTitle,
  recordCount,
  counts,
  search,
  activeCollectionIcon,
  recordsByCollection,
}: WireframeCollectionLinksProps) {
  const schemaPages = useSchemaPageTablesQuery();
  const newTableActive = useLocation().pathname === "/new-table";
  const existingCollectionTables = new Set<string>([
    ...collections.flatMap((item) => [item.tableName, item.label]),
    "Transactions",
  ]);
  const schemaCollections = (schemaPages.data?.tables ?? [])
    .filter((table) => !existingCollectionTables.has(table.name))
    .map((table) => ({
      label: table.name,
      tableName: table.name,
      to: `/schema/${encodeURIComponent(table.name)}`,
      domain: customCollectionDomain,
      hue: undefined,
    }));
  const visibleItems = [...collections, ...schemaCollections];
  const normalizedSearch = search.trim().toLowerCase();
  const navigationPreferences = useTableNavigationPreferences(visibleItems.map((item) => item.tableName));
  const searchTerms = normalizedSearch.split(/\s+/).filter(Boolean);
  const matchesSearch = (item: (typeof visibleItems)[number]) => {
    if (searchTerms.length === 0) return true;
    const savedTitle = navigationPreferences[item.tableName]?.title;
    const navigationLabel =
      item.label === activeCollection && activeCollectionTitle?.trim()
        ? activeCollectionTitle.trim()
        : typeof savedTitle === "string" && savedTitle.trim()
          ? savedTitle.trim()
          : item.label;
    if (
      searchTerms.every((term) => navigationLabel.toLowerCase().includes(term)) ||
      searchTerms.every((term) => item.label.toLowerCase().includes(term))
    )
      return true;
    return (
      recordsByCollection[item.label]?.some((record) => {
        let searchable = "";
        try {
          searchable = JSON.stringify(record).toLowerCase();
        } catch {
          searchable = "";
        }
        return searchTerms.every((term) => searchable.includes(term));
      }) ?? false
    );
  };
  const visibleCollections = visibleItems.filter(matchesSearch);
  const { collapsed, toggle } = useCollapsedDomains();
  const domainSections = visibleCollections.reduce<
    Array<{ domain: string; hue?: string; items: typeof visibleCollections }>
  >((sections, item) => {
    const section = sections.find((candidate) => candidate.domain === item.domain);
    if (section) section.items.push(item);
    else sections.push({ domain: item.domain, hue: item.hue, items: [item] });
    return sections;
  }, []);

  return (
    <>
      <nav className="demo-collections" aria-label="Collections">
        <GemButton
          asChild
          variant="quiet"
          tone="secondary"
          className={`wireframe-collection-link wireframe-collection-create-table${newTableActive ? " active" : ""}`}
        >
          <Link to="/new-table" aria-label="Create a new table" aria-current={newTableActive ? "page" : undefined}>
            <span className="wireframe-collection-link-name">
              <span className="wireframe-collection-link-icon" aria-hidden="true">
                ＋
              </span>
              <span className="wireframe-navigation-label">New table</span>
            </span>
          </Link>
        </GemButton>
        {domainSections.map((section) => {
          const sectionID = `wireframe-domain-${section.domain.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          // Searching shows every match, so collapsed sections open while a search is active.
          const expanded = searchTerms.length > 0 || !collapsed.includes(section.domain);
          const containsActive = section.items.some((item) => item.label === activeCollection);
          return (
            <section key={section.domain} className="wireframe-domain-section">
              <button
                type="button"
                className={`wireframe-domain-section-toggle${containsActive ? " contains-active" : ""}`}
                aria-expanded={expanded}
                aria-controls={sectionID}
                onClick={() => toggle(section.domain)}
                style={section.hue ? ({ "--gem-domain-hue": section.hue } as React.CSSProperties) : undefined}
              >
                <span className="wireframe-domain-section-dot" aria-hidden="true" />
                <span className="wireframe-domain-section-label">{section.domain}</span>
                <ChevronDown className="wireframe-domain-section-chevron" size={14} aria-hidden="true" />
              </button>
              {expanded ? (
                <div id={sectionID} className="wireframe-domain-section-items">
                  {section.items.map((item) => {
                    const savedTitle = navigationPreferences[item.tableName]?.title;
                    const displayLabel =
                      item.label === activeCollection && activeCollectionTitle?.trim()
                        ? activeCollectionTitle.trim()
                        : typeof savedTitle === "string" && savedTitle.trim()
                          ? savedTitle.trim()
                          : item.label;
                    const saved =
                      typeof navigationPreferences[item.tableName]?.icon === "string"
                        ? (navigationPreferences[item.tableName]?.icon as string)
                        : typeof window !== "undefined"
                          ? window.localStorage.getItem(`gemsforge:table-icon:${item.tableName}`)
                          : null;
                    const Icon = getPropertyIconByName(saved || "Folder").icon;
                    const hue = item.hue;
                    return (
                      <GemButton
                        asChild
                        variant="quiet"
                        tone="secondary"
                        className={`wireframe-collection-link${item.label === activeCollection ? " active" : ""}`}
                        key={item.label}
                      >
                        <Link
                          to={item.to}
                          title={displayLabel}
                          aria-label={displayLabel}
                          aria-current={item.label === activeCollection ? "page" : undefined}
                          style={hue ? ({ "--gem-domain-hue": hue } as React.CSSProperties) : undefined}
                        >
                          <span className="wireframe-collection-link-name">
                            <span className="wireframe-collection-link-icon" aria-hidden="true">
                              {hue ? (
                                <span className="wireframe-gem-hue-dot" style={{ background: hue }} />
                              ) : item.label === activeCollection && activeCollectionIcon ? (
                                activeCollectionIcon
                              ) : (
                                <Icon size={16} />
                              )}
                            </span>
                            <span className="wireframe-navigation-label">{displayLabel}</span>
                          </span>
                          <Text asChild>
                            <small>{item.label === activeCollection ? recordCount : (counts[item.label] ?? "—")}</small>
                          </Text>
                        </Link>
                      </GemButton>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
        {visibleCollections.length === 0 ? (
          <Text className="demo-navigation-empty">No matching collections</Text>
        ) : null}
      </nav>
    </>
  );
}
