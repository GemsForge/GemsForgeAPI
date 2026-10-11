import type { Domain } from "../../types";

interface DomainSidebarProps {
  domains: Domain[];
  selectedDomainID: string | null;
  onSelect: (domainID: string) => void;
  onRefresh: () => void;
  huesSelected: boolean;
  onSelectHues: () => void;
  educationSelected: boolean;
  onSelectEducation: () => void;
  employmentSelected: boolean;
  onSelectEmployment: () => void;
  addressesSelected: boolean;
  onSelectAddresses: () => void;
  transactionsSelected: boolean;
  onSelectTransactions: () => void;
  databasesSelected: boolean;
  onSelectDatabases: () => void;
  schemaSelected: boolean;
  onSelectSchema: () => void;
}

export function DomainSidebar({
  domains,
  selectedDomainID,
  onSelect,
  onRefresh,
  huesSelected,
  onSelectHues,
  educationSelected,
  onSelectEducation,
  employmentSelected,
  onSelectEmployment,
  addressesSelected,
  onSelectAddresses,
  transactionsSelected,
  onSelectTransactions,
  databasesSelected,
  onSelectDatabases,
  schemaSelected,
  onSelectSchema,
}: DomainSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="section-heading">
        <span>Domains</span>
        <button className="icon-button" title="Refresh data" onClick={onRefresh}>↻</button>
      </div>
      <div className="domain-list">
        {domains.map((domain) => (
          <button
            className={`domain-button ${selectedDomainID === domain.id && !huesSelected ? "selected" : ""}`}
            key={domain.id}
            onClick={() => onSelect(domain.id)}
          >
            <span className="domain-mark">{domain.id.slice(0, 1)}</span>
            <span><strong>{domain.title}</strong><small>{domain.id}</small></span>
            <span className="arrow">›</span>
          </button>
        ))}
      </div>
      <div className="sidebar-note">
        <strong>Stable core</strong>
        <p>Domains organize the pages that live in ForgeKeeper.</p>
      </div>
      <div className="sidebar-section">
        <div className="section-heading"><span>Reference data</span></div>
        <button className={`resource-button ${huesSelected ? "selected" : ""}`} onClick={onSelectHues}>
          <span className="resource-mark">●</span>
          <span><strong>Gem Hues</strong><small>Foundation palette</small></span>
          <span className="arrow">›</span>
        </button>
      </div>
      <div className="sidebar-section">
        <div className="section-heading"><span>Life data</span></div>
        <button className={`resource-button ${educationSelected ? "selected" : ""}`} onClick={onSelectEducation}>
          <span className="resource-mark life-mark">✦</span>
          <span><strong>Education</strong><small>Life-area records</small></span>
          <span className="arrow">›</span>
        </button>
        <button className={`resource-button ${employmentSelected ? "selected" : ""}`} onClick={onSelectEmployment}>
          <span className="resource-mark life-mark">◆</span>
          <span><strong>Employment</strong><small>Life-area records</small></span>
          <span className="arrow">›</span>
        </button>
        <button className={`resource-button ${addressesSelected ? "selected" : ""}`} onClick={onSelectAddresses}>
          <span className="resource-mark life-mark">⌂</span>
          <span><strong>Addresses</strong><small>Life-area records</small></span>
          <span className="arrow">›</span>
        </button>
        <button className={`resource-button ${transactionsSelected ? "selected" : ""}`} onClick={onSelectTransactions}>
          <span className="resource-mark life-mark">$</span>
          <span><strong>Expense Tracker</strong><small>Life-area records</small></span>
          <span className="arrow">›</span>
        </button>
      </div>
      <div className="sidebar-section">
        <div className="section-heading"><span>Developer</span></div>
        <button className={`resource-button ${databasesSelected ? "selected" : ""}`} onClick={onSelectDatabases}>
          <span className="resource-mark">⌘</span>
          <span><strong>Local Databases</strong><small>Safe test database creation</small></span>
          <span className="arrow">›</span>
        </button>
        <button className={`resource-button ${schemaSelected ? "selected" : ""}`} onClick={onSelectSchema}>
          <span className="resource-mark">▦</span>
          <span><strong>Live Schema</strong><small>Read-only database map</small></span>
          <span className="arrow">›</span>
        </button>
      </div>
    </aside>
  );
}
