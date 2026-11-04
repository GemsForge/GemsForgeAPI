import { Text } from "tamagui";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { GemButton } from "@gemsforge/ui";
import { useTableIconPreferences } from "../../data/presentationQueries";
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
  const normalizedSearch = search.trim().toLowerCase();
  const iconPreferences = useTableIconPreferences(collections.map((item) => item.tableName));
  const searchTerms = normalizedSearch.split(/\s+/).filter(Boolean);
  const visibleCollections = collections.filter((item) => {
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
  });

  return (
    <nav className="demo-collections" aria-label="Collections">
      {visibleCollections.map((item) => (
        <GemButton
          asChild
          variant="quiet"
          tone="secondary"
          className={`wireframe-collection-link${item.label === activeCollection ? " active" : ""}`}
          key={item.label}
        >
          <Link to={item.to} title={item.label} aria-current={item.label === activeCollection ? "page" : undefined}>
            <span className="wireframe-collection-link-name">
              <span className="wireframe-collection-link-icon" aria-hidden="true">
                {item.label === activeCollection && activeCollectionIcon
                  ? activeCollectionIcon
                  : (() => {
                      const saved =
                        typeof iconPreferences[item.tableName] === "string"
                          ? (iconPreferences[item.tableName] as string)
                          : typeof window !== "undefined"
                            ? window.localStorage.getItem(`gemsforge:table-icon:${item.tableName}`)
                            : null;
                      const Icon = getPropertyIconByName(saved || "Folder").icon;
                      return <Icon size={16} />;
                    })()}
              </span>
              {item.label}
            </span>
            <Text asChild>
              <small>{item.label === activeCollection ? recordCount : (counts[item.label] ?? "—")}</small>
            </Text>
          </Link>
        </GemButton>
      ))}
      {visibleCollections.length === 0 ? <Text className="demo-navigation-empty">No matching collections</Text> : null}
    </nav>
  );
}
