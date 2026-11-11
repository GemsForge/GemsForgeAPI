import { Link, NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import type { Domain } from "../../types";
import { useSchemaPageTablesQuery } from "../../data/workflowQueries";
import { usePagesQuery } from "../../data/workflowQueries";
import { inspectionBypassEnabled } from "../../auth/session";
import { workspacePreviewPages } from "../workspace/workspacePreviewData";

const resources = [
  ["/", "Home", "Gem Life", "⌂"],
  ["/workspace", "Workspace", "Pages, tables, and links", "✧"],
  ["/domains", "Domains", "ForgeKeeper organization", "◈"],
  ["/forgekeeper", "ForgeKeeper", "All root pages", "⌁"],
  ["/gemhues", "Gem Hues", "Foundation palette", "●"],
  ["/education", "Education", "Life-area records", "✦"],
  ["/employment", "Employment", "Life-area records", "◆"],
  ["/addresses", "Addresses", "Life-area records", "⌂"],
  ["/transactions", "Expense Tracker", "Life-area records", "$"],
  ["/service-accounts", "Services", "Recurring accounts", "◎"],
  ["/local-databases", "Local Databases", "Safe test database creation", "⌘"],
  ["/schema-builder", "Schema Builder", "Build, import, and inspect", "▦"],
  ["/wireframe-demo", "Wireframe Demo", "Visual layout prototype", "▤"],
  ["/live-database", "Live Database", "Preview and apply migrations", "⇄"],
] as const;

export function DomainSidebar({ domains, onRefresh }: { domains: Domain[]; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const schemaPages = useSchemaPageTablesQuery();
  const location = useLocation();
  const isWorkspace = location.pathname === "/workspace" || location.pathname === "/";
  const rootPagesQuery = usePagesQuery({ kind: "roots" }, isWorkspace && !inspectionBypassEnabled);
  const rootPages = inspectionBypassEnabled
    ? rootPagesQuery.data?.length
      ? rootPagesQuery.data
      : workspacePreviewPages
    : (rootPagesQuery.data ?? []);
  const linkClass = ({ isActive }: { isActive: boolean }) => `resource-button ${isActive ? "selected" : ""}`;

  if (isWorkspace) {
    const selectedPageID = Number(new URLSearchParams(location.search).get("page")) || rootPages[0]?.id;
    return (
      <aside className="sidebar app-navigation" aria-label="Gem Life sidebar">
        <Link className="shell-brand" to="/workspace" aria-label="Gem Life home">
          <span className="shell-brand-mark" aria-hidden="true">
            ◇
          </span>
          <span>GEM LIFE</span>
        </Link>
        <nav className="workspace-primary-navigation" aria-label="Gem Life navigation">
          <NavLink to="/" end className={linkClass}>
            <span aria-hidden="true">⌂</span>Home
          </NavLink>
          <NavLink to="/workspace" className={linkClass}>
            <span aria-hidden="true">▤</span>Library
          </NavLink>
          <NavLink to="/domains" className={linkClass}>
            <span aria-hidden="true">◇</span>Projects
          </NavLink>
          <NavLink to="/education" className={linkClass}>
            <span aria-hidden="true">♧</span>Life areas
          </NavLink>
        </nav>
        <div className="workspace-library-heading">Your library</div>
        <nav className="workspace-root-navigation" aria-label="Your library">
          {rootPages.map((page, index) => (
            <Link
              key={page.id}
              className={`workspace-root-link ${page.id === selectedPageID ? "selected" : ""}`}
              aria-current={page.id === selectedPageID ? "page" : undefined}
              to={`/workspace?page=${page.id}`}
            >
              <span aria-hidden="true">{index === 2 ? "▦" : index === 3 ? "▤" : "♧"}</span>
              <span>{page.title}</span>
            </Link>
          ))}
          {rootPagesQuery.isLoading && !inspectionBypassEnabled ? <p role="status">Loading pages…</p> : null}
        </nav>
        <div className="workspace-sidebar-botanical" aria-hidden="true" />
      </aside>
    );
  }

  return (
    <aside className="sidebar app-navigation" aria-label="Gem Life sidebar">
      <Link className="shell-brand" to="/" aria-label="Gem Life home">
        <span className="shell-brand-mark" aria-hidden="true">
          ◇
        </span>
        <span>GEM LIFE</span>
      </Link>
      <button
        className="sidebar-toggle secondary-button"
        aria-expanded={expanded}
        aria-controls="sidebar-links"
        onClick={() => setExpanded(!expanded)}
      >
        Navigation
      </button>
      <div
        id="sidebar-links"
        className={`navigation-links ${expanded ? "is-open" : ""}`}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setExpanded(false);
        }}
      >
        <nav aria-label="Gem Life navigation">
          {resources.map(([to, title, subtitle, mark]) => (
            <NavLink className={linkClass} to={to} end key={to} aria-label={title}>
              <span className="resource-mark" aria-hidden="true">
                {mark}
              </span>
              <span>
                <strong>{title}</strong>
                <small>{subtitle}</small>
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="section-heading">
          <span>Your schema pages</span>
        </div>
        {schemaPages.isPending ? <small role="status">Loading schema pages…</small> : null}
        {schemaPages.isError ? <small role="alert">Schema pages could not be loaded.</small> : null}
        {schemaPages.isSuccess && schemaPages.data.tables.length === 0 ? <small>No schema pages yet.</small> : null}
        {schemaPages.data?.tables.length ? (
          <nav className="domain-list" aria-label="Schema page navigation">
            {schemaPages.data.tables.map((table) => (
              <NavLink
                className={({ isActive }) => `domain-button ${isActive ? "selected" : ""}`}
                to={`/schema/${encodeURIComponent(table.name)}`}
                key={table.name}
                aria-label={table.name}
              >
                <span className="domain-mark" aria-hidden="true">
                  ▦
                </span>
                <span>
                  <strong>{table.name}</strong>
                  <small>{table.columns.length} properties</small>
                </span>
              </NavLink>
            ))}
          </nav>
        ) : null}
        <div className="section-heading">
          <span>Domains</span>
          <button className="icon-button" aria-label="Refresh domains" onClick={onRefresh}>
            ↻
          </button>
        </div>
        <nav className="domain-list" aria-label="Domain navigation">
          {domains.map((domain) => (
            <NavLink
              className={({ isActive }) => `domain-button ${isActive ? "selected" : ""}`}
              to={`/domains/${encodeURIComponent(domain.id)}`}
              key={domain.id}
              aria-label={domain.title}
            >
              <span className="domain-mark" aria-hidden="true">
                {domain.id.slice(0, 1)}
              </span>
              <span>
                <strong>{domain.title}</strong>
                <small>{domain.id}</small>
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <strong>Stable core</strong>
          <p>Domains organize the pages that live in ForgeKeeper.</p>
        </div>
      </div>
    </aside>
  );
}
