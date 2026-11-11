import { styled, Text, YStack } from "tamagui";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { GSearchField } from "@gemsforge/ui";
import { WireframeCollectionLinks } from "./WireframeCollectionLinks";
import { WireframePageLinks } from "./WireframePageLinks";
import { WireframePrimaryLinks } from "./WireframePrimaryLinks";
import { WireframeUtilityLinks } from "./WireframeUtilityLinks";
import { WireframeWorkspaceHeader } from "./WireframeWorkspaceHeader";
import {
  useAddressesQuery,
  useEducationQuery,
  useEmploymentQuery,
  useGemHuesQuery,
  useServiceAccountsQuery,
  useTransactionsQuery,
} from "../../data/lifeQueries";

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
  activeCollectionTitle?: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onCloseNavigation?: () => void;
  mobileDrawerOpen?: boolean;
  activeCollectionIcon?: ReactNode;
};

export function WireframeLeftPane({
  recordCount,
  activeCollection = "Education",
  activeCollectionTitle,
  collapsed = false,
  onToggleCollapsed,
  onCloseNavigation,
  mobileDrawerOpen = false,
  activeCollectionIcon,
}: WireframeLeftPaneProps) {
  const [search, setSearch] = useState("");
  const counts = {
    "Gem Hues": useGemHuesQuery(true).data?.length,
    Education: useEducationQuery(true).data?.length,
    Employment: useEmploymentQuery(true).data?.length,
    Addresses: useAddressesQuery(true).data?.length,
    "Expense Tracker": useTransactionsQuery(true).data?.length,
    Services: useServiceAccountsQuery(true).data?.length,
  };
  const recordsByCollection: Record<string, readonly unknown[]> = {
    "Gem Hues": useGemHuesQuery(true).data ?? [],
    Education: useEducationQuery(true).data ?? [],
    Employment: useEmploymentQuery(true).data ?? [],
    Addresses: useAddressesQuery(true).data ?? [],
    "Expense Tracker": useTransactionsQuery(true).data ?? [],
    Services: useServiceAccountsQuery(true).data ?? [],
  };
  return (
    <WireframeNavigation asChild paddingVertical={mobileDrawerOpen ? 0 : "$wireframeContent"}>
      <nav className={`wireframe-demo-sidebar ${collapsed ? "is-collapsed" : ""}`} aria-label="Workspace navigation">
        <WireframeWorkspaceHeader compact={collapsed} />
        <div className="demo-search">
          <span aria-hidden="true">⌕</span>
          <GSearchField
            aria-label="Search workspace navigation"
            placeholder="Search anything…"
            value={search}
            onChange={setSearch}
          />
          <kbd>⌘ K</kbd>
        </div>
        <WireframePrimaryLinks search={search} />
        <WireframePageLinks search={search} />
        <Text asChild>
          <p className="demo-sidebar-label">Collections</p>
        </Text>
        <WireframeCollectionLinks
          activeCollection={activeCollection}
          activeCollectionTitle={activeCollectionTitle}
          recordCount={recordCount}
          counts={counts}
          activeCollectionIcon={activeCollectionIcon}
          search={search}
          recordsByCollection={recordsByCollection}
        />
        <div className="demo-sidebar-bottom">
          <WireframeUtilityLinks />
          {onToggleCollapsed ? (
            <button
              type="button"
              className="demo-sidebar-toggle demo-sidebar-toggle-bottom demo-sidebar-toggle-desktop"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              title={collapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={!collapsed}
              onClick={onToggleCollapsed}
            >
              {collapsed ? (
                <PanelLeftOpen size={16} aria-hidden="true" />
              ) : (
                <PanelLeftClose size={16} aria-hidden="true" />
              )}
              <span>{collapsed ? "Expand navigation" : "Collapse navigation"}</span>
            </button>
          ) : null}
          {onCloseNavigation ? (
            <button
              type="button"
              className="demo-sidebar-toggle demo-sidebar-toggle-bottom demo-sidebar-toggle-mobile"
              aria-label="Close navigation"
              title="Close navigation"
              aria-expanded="true"
              onClick={onCloseNavigation}
            >
              <X size={16} aria-hidden="true" />
              <span>Close navigation</span>
            </button>
          ) : null}
        </div>
      </nav>
    </WireframeNavigation>
  );
}
