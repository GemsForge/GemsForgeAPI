import React, { cloneElement, isValidElement, useMemo, useRef, useState, type ReactNode } from "react";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, type ColDef } from "ag-grid-community";
import { useLiveSchemaQuery } from "../../data/workflowQueries";
import { WireframeLeftPane } from "./WireframeLeftPane";
import { WireframePageView } from "./WireframePageView";
import { getPropertyIconDefinition } from "./propertyIcons";
import { PropertyIcon, PropertyIconPicker } from "./PropertyIconPicker";

export type WireframeRecord = { id: string };
export type WireframeCollectionConfig<T extends WireframeRecord> = {
  tableName?: string;
  title: string;
  description: string;
  activeCollection: string;
  records: readonly T[];
  searchValues: (record: T) => string[];
  cardTitle: (record: T) => string;
  cardSubtitle: (record: T) => string;
  cardStatus: (record: T) => string;
  cardMeta: (record: T) => string;
  cardImage?: (record: T) => { src: string; alt: string } | undefined;
  inspector: (record: T) => ReactNode;
};
const cardColors = ["#e8b17d", "#a8d2cf", "#9dc9e0", "#e8b3b7"];

export function WireframeCollectionView<T extends WireframeRecord>({
  config,
}: {
  config: WireframeCollectionConfig<T>;
}) {
  const schemaQuery = useLiveSchemaQuery();
  const [view, setView] = useState<"table" | "list" | "gallery">("gallery");
  const [selectedID, setSelectedID] = useState<string | null>(config.records[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [propertyDetails, setPropertyDetails] = useState<{
    label: string;
    value: string;
    type: string;
    icon: string;
    statusText: string;
    colorToken: string;
  } | null>(null);
  const selectedCardRef = useRef<HTMLButtonElement | null>(null);
  const selected = config.records.find((record) => record.id === selectedID) ?? null;
  const schema = schemaQuery.data?.tables.find((table) => table.name === (config.tableName ?? config.title));
  const filteredRecords = useMemo(
    () =>
      config.records.filter((record) =>
        config.searchValues(record).some((value) => value.toLowerCase().includes(query.trim().toLowerCase())),
      ),
    [config, query],
  );
  const closeInspector = () => {
    setSelectedID(null);
    requestAnimationFrame(() => selectedCardRef.current?.focus());
  };
  const openPropertyDetails = (details: { label: string; value: string; type?: string; icon?: string }) =>
    setPropertyDetails({
      ...details,
      type: details.type ?? propertyTypeForLabel(details.label),
      icon: details.icon ?? getPropertyIconDefinition(details.label).name,
      statusText: details.value,
      colorToken: "mint",
    });
  return (
    <section
      className="wireframe-demo wireframe-standalone"
      data-schema-table={schema?.name ?? config.tableName ?? config.title}
      aria-labelledby="wireframe-page-title"
    >
      <button
        type="button"
        className="wireframe-mobile-nav-toggle"
        aria-expanded={mobileNavigationOpen}
        aria-controls="wireframe-navigation"
        onClick={() => setMobileNavigationOpen((open) => !open)}
      >
        ☰ <span>Navigation</span>
      </button>
      <div
        id="wireframe-navigation"
        className={mobileNavigationOpen ? "wireframe-mobile-nav is-open" : "wireframe-mobile-nav"}
      >
        <WireframeLeftPane recordCount={config.records.length} activeCollection={config.activeCollection} />
      </div>
      <WireframePageView title={config.title} description={config.description} recordCount={filteredRecords.length}>
        <div className="demo-toolbar">
          <div className="demo-view-tabs" role="tablist" aria-label={`${config.title} view mode`}>
            {(["table", "list", "gallery"] as const).map((mode) => (
              <button
                className={view === mode ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={view === mode}
                onClick={() => setView(mode)}
                key={mode}
              >
                {mode === "table" ? "▣" : mode === "list" ? "☷" : "▦"} {mode[0].toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <label className="demo-collection-search">
            ⌕{" "}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={`Search ${config.title}`}
              placeholder="Search this collection…"
            />
          </label>
          <button
            type="button"
            className="demo-filter"
            aria-label={query ? "Clear search" : "Filter records"}
            title={query ? "Clear search" : "Filter records"}
            disabled={!query}
            onClick={() => setQuery("")}
          >
            {query ? "×" : "≡"}
          </button>
          <button type="button" className="demo-sort">
            ↕ Sort
          </button>
        </div>
        {filteredRecords.length === 0 ? (
          <div className="wireframe-empty-state" role="status">
            <strong>No {config.title.toLowerCase()} records found</strong>
            <p>Try a different search.</p>
          </div>
        ) : (
          <div className={`demo-results demo-${view}`} role="list" aria-label={`${config.title} records`}>
            {view === "table" ? <WireframeAgGrid records={filteredRecords} /> : filteredRecords.map((record, index) => (
              <button
                ref={selectedID === record.id ? selectedCardRef : undefined}
                type="button"
                role="listitem"
                aria-pressed={selectedID === record.id}
                className={`demo-place-card ${selectedID === record.id ? "selected" : ""}`}
                onClick={() => setSelectedID(record.id)}
                key={record.id}
              >
                {config.cardImage?.(record)?.src ? (
                  <span className="demo-place-image"><img src={config.cardImage(record)?.src} alt={config.cardImage(record)?.alt ?? ""} /></span>
                ) : (
                  <span className="demo-place-image" style={{ background: `linear-gradient(135deg, ${cardColors[index % cardColors.length]}, #527b82)` }} aria-hidden="true" />
                )}
                <span className="demo-place-copy">
                  <strong>{config.cardTitle(record)}</strong>
                  <small>{config.cardSubtitle(record)}</small>
                  <em>{config.cardStatus(record)}</em>
                  <small className="demo-place-meta">
                    {config.cardMeta(record)}　▤ {record.id}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}
      </WireframePageView>
      {selected ? (
        <aside className="wireframe-demo-inspector" aria-labelledby="wireframe-inspector-title">
          <div className="demo-inspector-heading">
            <div>
              <p>Record inspector</p>
              <h2 id="wireframe-inspector-title">{config.cardTitle(selected)}</h2>
            </div>
            <button type="button" aria-label="Close inspector" onClick={closeInspector}>
              ×
            </button>
          </div>
          <div className="demo-cover" style={{ background: "linear-gradient(135deg, #e8b17d, #527b82)" }} />
          {renderInspector(config.inspector(selected), openPropertyDetails)}
        </aside>
      ) : (
        <aside className="wireframe-demo-inspector wireframe-empty-inspector" aria-label="Record inspector">
          <p>Select a record to inspect it.</p>
        </aside>
      )}
      {propertyDetails ? (
        <div className="wireframe-property-details-backdrop" role="presentation" onClick={() => setPropertyDetails(null)}>
          <section
            className="wireframe-property-details"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wireframe-property-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" aria-label="Close property details" onClick={() => setPropertyDetails(null)}>
              ×
            </button>
            <div className="wireframe-property-details-heading">
              <span className="wireframe-property-details-icon" aria-hidden="true">
                <PropertyIcon name={propertyDetails.icon} />
              </span>
              <div>
                <h3 id="wireframe-property-details-title">Property settings</h3>
                <p>{propertyDetails.label}</p>
              </div>
            </div>
            <div className="wireframe-property-details-preview">
              <strong>Current value</strong>
              <p>{propertyDetails.value || "No value recorded."}</p>
            </div>
            <label>
              Property name
              <input
                id="wireframe-property-name"
                value={propertyDetails.label}
                readOnly={isIdentityProperty(propertyDetails.label)}
                onChange={(event) => setPropertyDetails({ ...propertyDetails, label: event.target.value })}
              />
            </label>
            <label>
              Primitive type
              <select
                id="wireframe-property-type"
                value={propertyDetails.type}
                onChange={(event) => setPropertyDetails({ ...propertyDetails, type: event.target.value })}
              >
                <option>Text</option>
                <option>Number</option>
                <option>Date</option>
                <option>Status</option>
                <option>Tags</option>
                <option>URL</option>
                <option>Notes</option>
              </select>
            </label>
            <fieldset className="wireframe-property-icon-fieldset">
              <legend>Icon</legend>
              <PropertyIconPicker
                value={propertyDetails.icon}
                onChange={(icon) => setPropertyDetails({ ...propertyDetails, icon })}
              />
            </fieldset>
            <label>
              Status text
              <input
                id="wireframe-property-status-text"
                value={propertyDetails.statusText}
                onChange={(event) => setPropertyDetails({ ...propertyDetails, statusText: event.target.value })}
              />
            </label>
            <label>
              Pill color
              <select
                id="wireframe-property-color"
                value={propertyDetails.colorToken}
                onChange={(event) => setPropertyDetails({ ...propertyDetails, colorToken: event.target.value })}
              >
                <option value="mint">Mint</option>
                <option value="gold">Gold</option>
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="purple">Purple</option>
                <option value="orange">Orange</option>
                <option value="red">Red</option>
                <option value="gray">Gray</option>
              </select>
            </label>
            <div className="wireframe-property-details-actions">
              <button type="button" className="demo-secondary-button" onClick={() => setPropertyDetails(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="wireframe-property-save-button"
                aria-label="Save property settings"
                title="Save property settings"
                onClick={() => setPropertyDetails(null)}
              >
                ✓
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function WireframeAgGrid<T extends WireframeRecord>({ records }: { records: readonly T[] }) {
  const first = records[0] as Record<string, unknown> | undefined;
  const fields = first ? Object.keys(first) : [];
  const columns: ColDef<T>[] = fields.map((field) => ({ field: field as keyof T & string, headerName: field, flex: 1, minWidth: 140 }));
  return <div className="wireframe-ag-grid"><AgGridReact<T> theme={themeQuartz} rowData={[...records]} columnDefs={columns} getRowId={({ data }) => data.id} domLayout="autoHeight" /></div>;
}
function renderInspector(
  node: ReactNode,
  onDetails: (details: { label: string; value: string; type?: string; icon?: string }) => void,
): ReactNode {
  if (!isValidElement(node) || node.type !== "dl") return node;
  return cloneElement(
    node as React.ReactElement<{ children?: ReactNode }>,
    {},
    React.Children.map((node.props as { children?: ReactNode }).children, (row) => {
      if (!isValidElement(row)) return row;
      const children = React.Children.toArray((row.props as { children?: ReactNode }).children);
      const label = children.find((child) => isValidElement(child) && child.type === "dt");
      const value = children.find((child) => isValidElement(child) && child.type === "dd");
      if (!isValidElement(label) || !isValidElement(value)) return row;
      const labelText = String((label.props as { children?: ReactNode }).children ?? "");
      const propertyKind = (label.props as { "data-property-kind"?: string })["data-property-kind"];
      const valueText = String((value.props as { children?: ReactNode }).children ?? "");
      return cloneElement(
        row as React.ReactElement,
        {},
        <>
          <dt>
            <button
              type="button"
              className="wireframe-property-details-trigger"
              aria-label={`Open details for ${labelText}`}
              onClick={() => onDetails({ label: labelText, value: valueText })}
            >
              <PropertyIcon name={getPropertyIconDefinition(labelText, propertyKind).name} size={13} />
            </button>
            {labelText}
          </dt>
          {value}
        </>,
      );
    }),
  );
}

function propertyTypeForLabel(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized === "name" || normalized === "title") return "Name";
  if (normalized.includes("date") || normalized.includes("time")) return "Date";
  if (normalized.includes("status")) return "Status";
  if (normalized.includes("multi") || normalized.includes("tag")) return "Multi-select";
  if (normalized.includes("amount") || normalized.includes("price") || normalized.includes("quantity")) return "Number";
  if (normalized.includes("url") || normalized.includes("website")) return "URL";
  if (normalized.includes("note")) return "Notes";
  return "Text";
}

function isIdentityProperty(label: string): boolean {
  return /^(id|item id|record id|primary key)$/i.test(label.trim());
}
