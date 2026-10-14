import { NavLink } from "react-router-dom";
import type { Domain } from "../../types";

const resources = [
  ["/", "Home", "Gem Life", "⌂"],
  ["/domains", "Domains", "ForgeKeeper organization", "◈"],
  ["/forgekeeper", "ForgeKeeper", "All root pages", "⌁"],
  ["/gemhues", "Gem Hues", "Foundation palette", "●"],
  ["/education", "Education", "Life-area records", "✦"],
  ["/employment", "Employment", "Life-area records", "◆"],
  ["/addresses", "Addresses", "Life-area records", "⌂"],
  ["/transactions", "Expense Tracker", "Life-area records", "$"],
  ["/local-databases", "Local Databases", "Safe test database creation", "⌘"],
  ["/schema-builder", "Schema Builder", "Build, import, and inspect", "▦"],
] as const;

export function DomainSidebar({ domains, onRefresh }: { domains: Domain[]; onRefresh: () => void }) {
  const linkClass = ({ isActive }: { isActive: boolean }) => `resource-button ${isActive ? "selected" : ""}`;
  return <aside className="sidebar">
    <nav aria-label="Gem Life navigation">
      {resources.map(([to, title, subtitle, mark]) => <NavLink className={linkClass} to={to} end key={to} aria-label={title}>
        <span className="resource-mark" aria-hidden="true">{mark}</span><span><strong>{title}</strong><small>{subtitle}</small></span>
      </NavLink>)}
    </nav>
    <div className="section-heading"><span>Domains</span><button className="icon-button" aria-label="Refresh domains" onClick={onRefresh}>↻</button></div>
    <nav className="domain-list" aria-label="Domain navigation">
      {domains.map((domain) => <NavLink className={({ isActive }) => `domain-button ${isActive ? "selected" : ""}`} to={`/domains/${encodeURIComponent(domain.id)}`} key={domain.id} aria-label={domain.title}>
        <span className="domain-mark" aria-hidden="true">{domain.id.slice(0, 1)}</span><span><strong>{domain.title}</strong><small>{domain.id}</small></span>
      </NavLink>)}
    </nav>
    <div className="sidebar-note"><strong>Stable core</strong><p>Domains organize the pages that live in ForgeKeeper.</p></div>
  </aside>;
}
