import React, { cloneElement, isValidElement, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, Expand, GalleryHorizontal, List, Minimize2, Table2 } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, type ColDef } from "ag-grid-community";
import { useLiveSchemaQuery } from "../../data/workflowQueries";
import { WireframeLeftPane } from "./WireframeLeftPane";
import { WireframePageView } from "./WireframePageView";
import { WireframeRecordPageView } from "./WireframeRecordPageView";
import { getPropertyIconDefinition } from "./propertyIcons";
import { PropertyIcon, PropertyIconPicker } from "./PropertyIconPicker";
import { formatRecordNumber, inferRecordNumberFormat } from "../../table-kit";
import { RecordList, type RecordPropertyDefinition, type TableRecord } from "../../table-kit";
import { useLocation, useNavigate } from "react-router-dom";

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
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<"table" | "list" | "gallery">("gallery");
  const [selectedID, setSelectedID] = useState<string | null>(config.records[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(384);
  const inspectorResizingRef = useRef(false);
  const [propertyDetails, setPropertyDetails] = useState<{
    label: string;
    value: string;
    type: string;
    icon: string;
    statusText: string;
    colorToken: string;
  } | null>(null);
  const selectedCardRef = useRef<HTMLButtonElement | null>(null);
  const recordPageID = location.pathname.match(/\/record\/([^/]+)$/)?.[1];
  const inspectorExpanded = Boolean(recordPageID);
  const selected = config.records.find((record) => record.id === (recordPageID ? decodeURIComponent(recordPageID) : selectedID)) ?? null;
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
    if (inspectorExpanded) navigate(location.pathname.replace(/\/record\/[^/]+$/, ""));
    requestAnimationFrame(() => selectedCardRef.current?.focus());
  };
  const openRecordPage = () => {
    if (selected) navigate(`${location.pathname.replace(/\/record\/[^/]+$/, "")}/record/${encodeURIComponent(selected.id)}`);
  };
  const handleInspectorPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!inspectorResizingRef.current) return;
    const bounds = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    setInspectorWidth(Math.min(640, Math.max(320, bounds.right - event.clientX)));
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
      className={`wireframe-demo wireframe-standalone ${inspectorExpanded ? "is-expanded" : ""} ${selected ? "has-inspector" : "inspector-closed"}`}
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
        <WireframeLeftPane
          recordCount={config.records.length}
          activeCollection={config.activeCollection}
          collapsed={navigationCollapsed}
          onToggleCollapsed={() => setNavigationCollapsed((collapsed) => !collapsed)}
        />
      </div>
      {inspectorExpanded && selected ? (
        <WireframeRecordPageView
          collectionTitle={config.title}
          recordTitle={config.cardTitle(selected)}
          onBack={() => navigate(location.pathname.replace(/\/record\/[^/]+$/, ""))}
          onClose={closeInspector}
          cover={<div className="demo-cover" style={{ background: "linear-gradient(135deg, #e8b17d, #527b82)" }} />}
        >
          {renderInspector(config.inspector(selected), openPropertyDetails)}
        </WireframeRecordPageView>
      ) : (
      <WireframePageView title={config.title} description={config.description} recordCount={filteredRecords.length}>
        <div className="demo-toolbar">
          <div className="demo-view-tabs" role="tablist" aria-label={`${config.title} view mode`}>
            {(["table", "list", "gallery"] as const).map((mode) => (
              <button
                className={view === mode ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={view === mode}
                aria-label={`${mode[0].toUpperCase() + mode.slice(1)} view`}
                title={`${mode[0].toUpperCase() + mode.slice(1)} view`}
                onClick={() => setView(mode)}
                key={mode}
              >
                {mode === "table" ? <Table2 size={18} aria-hidden="true" /> : mode === "list" ? <List size={18} aria-hidden="true" /> : <GalleryHorizontal size={18} aria-hidden="true" />}
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
            {view === "table" ? <WireframeAgGrid records={filteredRecords} onRecordSelect={setSelectedID} /> : view === "list" ? <WireframeMvpList config={config} records={filteredRecords} onRecordSelect={setSelectedID} /> : filteredRecords.map((record, index) => (
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
      )}
      {selected ? (
        inspectorExpanded ? null : <aside
          className={`wireframe-demo-inspector ${inspectorExpanded ? "is-expanded" : ""}`}
          style={{ "--inspector-width": `${inspectorWidth}px` } as React.CSSProperties}
          aria-labelledby="wireframe-inspector-title"
        >
          <div
            className="wireframe-inspector-resizer"
            role="separator"
            aria-label="Resize record inspector"
            aria-orientation="vertical"
            aria-valuemin={320}
            aria-valuemax={640}
            aria-valuenow={inspectorWidth}
            tabIndex={0}
            onPointerDown={(event) => {
              inspectorResizingRef.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={handleInspectorPointerMove}
            onPointerUp={(event) => {
              inspectorResizingRef.current = false;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => { inspectorResizingRef.current = false; }}
          />
          <div className="demo-inspector-heading">
            <div>
              <p>{inspectorExpanded ? "Record page" : "Record inspector"}</p>
              <h2 id="wireframe-inspector-title">{config.cardTitle(selected)}</h2>
            </div>
            <div className="demo-inspector-actions">
              {inspectorExpanded ? (
                <button type="button" aria-label="Back to collection" title="Back to collection" onClick={() => navigate(location.pathname.replace(/\/record\/[^/]+$/, ""))}><ChevronLeft size={16} aria-hidden="true" /></button>
              ) : (
                <button type="button" aria-label="Open record page" title="Open record page" onClick={openRecordPage}><Expand size={15} aria-hidden="true" /></button>
              )}
              <button type="button" aria-label="Close inspector" title="Close inspector" onClick={closeInspector}>×</button>
            </div>
          </div>
          <div className="demo-cover" style={{ background: "linear-gradient(135deg, #e8b17d, #527b82)" }} />
          {renderInspector(config.inspector(selected), openPropertyDetails)}
        </aside>
      ) : null}
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

function WireframeMvpList<T extends WireframeRecord>({
  config,
  records,
  onRecordSelect,
}: {
  config: WireframeCollectionConfig<T>;
  records: readonly T[];
  onRecordSelect: (id: string) => void;
}) {
  const tableRecords: readonly TableRecord<T>[] = records.map((record) => ({
    id: record.id,
    source: record,
    title: config.cardTitle(record),
    subtitle: config.cardSubtitle(record),
    status: { label: config.cardStatus(record) },
    image: config.cardImage?.(record),
  }));
  const first = records[0] as Record<string, unknown> | undefined;
  const properties: readonly RecordPropertyDefinition<T>[] = first
    ? Object.keys(first).filter((field) => field !== "id").map((field) => ({
        id: field,
        label: field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase()),
        kind: typeof first[field] === "number" ? "number" : "text",
        getValue: (record) => ({ raw: record[field], display: record[field] == null ? "—" : String(record[field]) }),
      }))
    : [];
  return <RecordList records={tableRecords} properties={properties} onExpansionChange={(id) => id && onRecordSelect(String(id))} />;
}

function WireframeAgGrid<T extends WireframeRecord>({ records, onRecordSelect }: { records: readonly T[]; onRecordSelect: (id: string) => void }) {
  const first = records[0] as Record<string, unknown> | undefined;
  const fields = first ? Object.keys(first) : [];
  const columns: ColDef<T>[] = fields.map((field) => ({
    field: field as keyof T & string,
    headerName: field,
    flex: 1,
    minWidth: 140,
    valueFormatter: ({ value }) => formatWireframeTableValue(field, value),
  }));
  return <div className="wireframe-ag-grid"><AgGridReact<T> theme={themeQuartz} rowData={[...records]} columnDefs={columns} getRowId={({ data }) => data.id} onRowClicked={({ data }) => data && onRecordSelect(data.id)} domLayout="autoHeight" /></div>;
}

function formatWireframeTableValue(field: string, value: unknown): string {
  if (typeof value !== "number") return value == null || value === "" ? "—" : String(value);
  return formatRecordNumber(value, inferRecordNumberFormat(field));
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
