import { Text } from "tamagui";
import { NavLink } from "react-router-dom";
import { FileText, Network } from "lucide-react";
import { GemButton } from "@gemsforge/ui";
import { useDomainsQuery } from "../../data/domainQueries";
import { usePagesQuery } from "../../data/workflowQueries";

type PageLink = { key: string; label: string; to: string; kind: "domain" | "page" };

/** Lists domains and root ForgeKeeper pages in the persistent navigation pane. */
export function WireframePageLinks({ search }: { search: string }) {
  const domains = useDomainsQuery();
  const rootPages = usePagesQuery({ kind: "roots" });
  const loading = domains.isPending || rootPages.isPending;
  const failed = domains.isError || rootPages.isError;
  const links: PageLink[] = [
    ...(domains.data ?? []).map((domain) => ({
      key: `domain-${domain.id}`,
      label: domain.title || domain.id,
      to: `/forgekeeper/domain/${encodeURIComponent(domain.id)}`,
      kind: "domain" as const,
    })),
    ...(rootPages.data ?? []).map((page) => ({
      key: `page-${page.id}`,
      label: page.title || "Untitled page",
      to: `/forgekeeper/${page.id}/children`,
      kind: "page" as const,
    })),
  ];
  const searchTerms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visibleLinks = links.filter((link) => searchTerms.every((term) => link.label.toLowerCase().includes(term)));

  return (
    <>
      <Text asChild>
        <p className="demo-sidebar-label" id="wireframe-pages-heading">
          Pages
        </p>
      </Text>
      <nav aria-labelledby="wireframe-pages-heading" className="demo-collections wireframe-page-links">
        {loading ? (
          <Text className="demo-navigation-empty" role="status">
            Loading pages…
          </Text>
        ) : failed ? (
          <div className="wireframe-page-links-error" role="alert">
            <Text className="demo-navigation-empty">Pages could not be loaded.</Text>
            <button
              type="button"
              className="wireframe-page-links-retry"
              onClick={() => {
                if (domains.isError) void domains.refetch();
                if (rootPages.isError) void rootPages.refetch();
              }}
            >
              Retry
            </button>
          </div>
        ) : links.length === 0 ? (
          <Text className="demo-navigation-empty">No pages yet</Text>
        ) : visibleLinks.length === 0 ? (
          <Text className="demo-navigation-empty">No matching pages</Text>
        ) : (
          visibleLinks.map((link) => {
            const Icon = link.kind === "domain" ? Network : FileText;
            return (
              <GemButton asChild variant="quiet" tone="secondary" className="wireframe-collection-link" key={link.key}>
                <NavLink to={link.to} title={link.label} aria-label={link.label}>
                  <span className="wireframe-collection-link-name">
                    <span className="wireframe-collection-link-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <span className="wireframe-navigation-label">{link.label}</span>
                  </span>
                </NavLink>
              </GemButton>
            );
          })
        )}
      </nav>
    </>
  );
}
