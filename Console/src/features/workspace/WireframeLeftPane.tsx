import { styled, Text, YStack } from "tamagui";
import { Link } from "react-router-dom";
import { GemButton } from "../../components/ui/GemButton";
import { GSearchField } from "../../components/ui/GSearchField";

const WireframeNavigation = styled(YStack, {
  paddingHorizontal: "$wireframePane",
  paddingVertical: "$wireframeContent",
  borderRightWidth: 1,
  borderRightColor: "$wireframeLine",
  backgroundColor: "$wireframeSidebar",
});

type WireframeLeftPaneProps = {
  recordCount: number;
  activeCollection?: string;
};

const navigation = [
  { label: "Home", icon: "⌂", to: "/" },
  { label: "Workspace", icon: "✦", to: "/workspace" },
  { label: "Domains", icon: "◇", to: "/domains" },
  { label: "ForgeKeeper", icon: "⌁", to: "/forgekeeper" },
] as const;

const collections = [
  { label: "Gem Hues", to: "/gemhues-wireframe" },
  { label: "Education", to: "/education-wireframe" },
  { label: "Employment", to: "/employment-wireframe" },
  { label: "Addresses", to: "/addresses-wireframe" },
  { label: "Expense Tracker", to: "/transactions-wireframe" },
  { label: "Services", to: "/service-catalog-wireframe" },
] as const;

export function WireframeLeftPane({ recordCount, activeCollection = "Education" }: WireframeLeftPaneProps) {
  return (
    <WireframeNavigation asChild>
      <nav className="wireframe-demo-sidebar" aria-label="Workspace navigation">
        <div className="demo-brand">
          <span className="demo-brand-mark">◆</span>
          <Text fontWeight="700">GemsForge</Text>
        </div>
        <div className="demo-search">
          <span aria-hidden="true">⌕</span>
          <GSearchField aria-label="Search workspace" placeholder="Search anything…" />
          <kbd>⌘ K</kbd>
        </div>
        <nav aria-label="Primary navigation" className="demo-nav">
          {navigation.map((item) => (
            <GemButton asChild variant="quiet" tone="secondary" className="demo-nav-button" key={item.label}>
              <Link to={item.to}>
                {item.icon} {item.label}
              </Link>
            </GemButton>
          ))}
        </nav>
        <Text asChild>
          <p className="demo-sidebar-label">
            Collections <span aria-hidden="true">＋</span>
          </p>
        </Text>
        <nav className="demo-collections" aria-label="Collections">
          {collections.map((item) => (
            <GemButton
              asChild
              variant="quiet"
              tone="secondary"
              className={item.label === activeCollection ? "active" : ""}
              key={item.label}
            >
              <Link to={item.to} aria-current={item.label === activeCollection ? "page" : undefined}>
                ◈ {item.label}
                <Text asChild>
                  <small>{item.label === activeCollection ? recordCount : "—"}</small>
                </Text>
              </Link>
            </GemButton>
          ))}
        </nav>
        <div className="demo-decision">
          ◫{" "}
          <Text asChild>
            <span>
              Dual navigation —<br />
              <Text fontWeight="700">recommended, not yet chosen</Text>
            </span>
          </Text>
        </div>
        <div className="demo-sidebar-bottom">
          <GemButton variant="quiet" tone="secondary" className="demo-trash" type="button">
            ♜ Trash{" "}
            <Text asChild>
              <small>3</small>
            </Text>
          </GemButton>
          <GemButton variant="quiet" tone="secondary" className="demo-trash" type="button">
            ⚙ Application Settings
          </GemButton>
        </div>
      </nav>
    </WireframeNavigation>
  );
}
