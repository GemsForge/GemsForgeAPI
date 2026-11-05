import { Text } from "tamagui";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { GemButton } from "@gemsforge/ui";
import { useTableIconPreferences } from "../../data/presentationQueries";
import { useSchemaPageTablesQuery } from "../../data/workflowQueries";
import { getPropertyIconByName } from "./propertyIcons";

const collections = [
  { label: "Gem Hues", tableName: "GemHues", to: "/gemhues-wireframe" },
  { label: "Education", tableName: "Education", to: "/education-wireframe" },
  { label: "Employment", tableName: "Employment", to: "/employment-wireframe" },
  { label: "Addresses", tableName: "Addresses", to: "/addresses-wireframe" },
  { label: "Expense Tracker", tableName: "ExpenseTransaction", to: "/transactions-wireframe" },
  { label: "Services", tableName: "Services", to: "/service-catalog-wireframe" },
] as const;

type WireframeCollectionLinksProps = {
  activeCollection: string;
  recordCount: number;
  counts: Record<string, number | undefined>;
  search: string;
  activeCollectionIcon?: ReactNode;
  recordsByCollection: Record<string, readonly unknown[]>;
};

export function WireframeCollectionLinks({
  activeCollection,
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
      to: `/schema-wireframe/${encodeURIComponent(table.name)}`,
    }));
  const visibleItems = [...collections, ...schemaCollections];
  const normalizedSearch = search.trim().toLowerCase();
  const iconPreferences = useTableIconPreferences(visibleItems.map((item) => item.tableName));
  const searchTerms = normalizedSearch.split(/\s+/).filter(Boolean);
  const matchesSearch = (item: (typeof visibleItems)[number]) => {
    if (searchTerms.length === 0) return true;
    if (searchTerms.every((term) => item.label.toLowerCase().includes(term))) return true;
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
          <Link to="/schema-builder-wireframe" aria-label="Create a new table">
            <span className="wireframe-collection-link-name">
              <span className="wireframe-collection-link-icon" aria-hidden="true">
                ＋
              </span>
              <span className="wireframe-navigation-label">New table</span>
            </span>
          </Link>
        </GemButton>
        {visibleCollections.map((item) => {
          const saved =
            typeof iconPreferences[item.tableName] === "string"
              ? (iconPreferences[item.tableName] as string)
              : typeof window !== "undefined"
                ? window.localStorage.getItem(`gemsforge:table-icon:${item.tableName}`)
                : null;
          const Icon = getPropertyIconByName(saved || "Folder").icon;
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
                title={item.label}
                aria-label={item.label}
                aria-current={item.label === activeCollection ? "page" : undefined}
              >
                <span className="wireframe-collection-link-name">
                  <span className="wireframe-collection-link-icon" aria-hidden="true">
                    {item.label === activeCollection && activeCollectionIcon ? (
                      activeCollectionIcon
                    ) : (
                      <Icon size={16} />
                    )}
                  </span>
                  <span className="wireframe-navigation-label">{item.label}</span>
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
