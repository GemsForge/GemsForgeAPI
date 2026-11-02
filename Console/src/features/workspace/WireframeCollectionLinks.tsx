import { Text } from "tamagui";
import { Link } from "react-router-dom";
import { GemButton } from "../../components/ui/GemButton";

const collections = [
  { label: "Gem Hues", to: "/gemhues-wireframe" },
  { label: "Education", to: "/education-wireframe" },
  { label: "Employment", to: "/employment-wireframe" },
  { label: "Addresses", to: "/addresses-wireframe" },
  { label: "Expense Tracker", to: "/transactions-wireframe" },
  { label: "Services", to: "/service-catalog-wireframe" },
] as const;

type WireframeCollectionLinksProps = {
  activeCollection: string;
  recordCount: number;
  counts: Record<string, number | undefined>;
  search: string;
};

export function WireframeCollectionLinks({
  activeCollection,
  recordCount,
  counts,
  search,
}: WireframeCollectionLinksProps) {
  const normalizedSearch = search.trim().toLowerCase();
  const visibleCollections = collections.filter((item) => item.label.toLowerCase().includes(normalizedSearch));

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
          <Link to={item.to} aria-current={item.label === activeCollection ? "page" : undefined}>
            <span className="wireframe-collection-link-name">
              <span aria-hidden="true">◈</span>
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
