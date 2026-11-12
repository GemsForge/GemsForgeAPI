import React from "react";
import { Text } from "tamagui";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { GemButton } from "@gemsforge/ui";
import { useTableNavigationPreferences } from "../../data/presentationQueries";
import { useSchemaPageTablesQuery } from "../../data/workflowQueries";
import { getPropertyIconByName } from "./propertyIcons";

const collections = [
  { label: "Gem Hues", tableName: "GemHues", to: "/gemhues", hue: "#7650A8" },
  { label: "Education", tableName: "Education", to: "/education", hue: "#2F5FA8" },
  { label: "Employment", tableName: "Employment", to: "/employment", hue: "#2F5FA8" },
  { label: "Addresses", tableName: "Addresses", to: "/addresses", hue: "#5C8A26" },
  { label: "Expense Tracker", tableName: "ExpenseTransaction", to: "/transactions", hue: "#A9771C" },
  { label: "Services", tableName: "Services", to: "/service-accounts", hue: "#237F8E" },
] as const;

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

  return (
    <>
      <nav className="demo-collections" aria-label="Collections">
        <GemButton
          asChild
          variant="quiet"
          tone="secondary"
          className="wireframe-collection-link wireframe-collection-create-table"
        >
          <Link to="/new-table" aria-label="Create a new table">
            <span className="wireframe-collection-link-name">
              <span className="wireframe-collection-link-icon" aria-hidden="true">
                ＋
              </span>
              <span className="wireframe-navigation-label">New table</span>
            </span>
          </Link>
        </GemButton>
        {visibleCollections.map((item) => {
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
          const hue = "hue" in item ? item.hue : undefined;
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
        {visibleCollections.length === 0 ? (
          <Text className="demo-navigation-empty">No matching collections</Text>
        ) : null}
      </nav>
    </>
  );
}
