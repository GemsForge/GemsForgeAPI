import { styled, Text, YStack } from "tamagui";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { GemButton } from "../../components/ui/GemButton";
import { GSearchField } from "../../components/ui/GSearchField";
import { WireframeWorkspaceHeader } from "./WireframeWorkspaceHeader";
import { useAddressesQuery, useEducationQuery, useEmploymentQuery, useGemHuesQuery, useServiceAccountsQuery, useTransactionsQuery } from "../../data/lifeQueries";

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
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
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

export function WireframeLeftPane({ recordCount, activeCollection = "Education", collapsed = false, onToggleCollapsed }: WireframeLeftPaneProps) {
  const counts = {
    "Gem Hues": useGemHuesQuery(true).data?.length,
    Education: useEducationQuery(true).data?.length,
    Employment: useEmploymentQuery(true).data?.length,
    Addresses: useAddressesQuery(true).data?.length,
    "Expense Tracker": useTransactionsQuery(true).data?.length,
    Services: useServiceAccountsQuery(true).data?.length,
  };
  return (
    <WireframeNavigation asChild>
      <nav className={`wireframe-demo-sidebar ${collapsed ? "is-collapsed" : ""}`} aria-label="Workspace navigation">
        <WireframeWorkspaceHeader compact={collapsed} />
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
                  <small>{item.label === activeCollection ? recordCount : counts[item.label] ?? "—"}</small>
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
          {onToggleCollapsed ? (
            <button
              type="button"
              className="demo-sidebar-toggle demo-sidebar-toggle-bottom"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              title={collapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={!collapsed}
              onClick={onToggleCollapsed}
            >
              {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
              <span>{collapsed ? "Expand navigation" : "Collapse navigation"}</span>
            </button>
          ) : null}
        </div>
      </nav>
    </WireframeNavigation>
  );
}
