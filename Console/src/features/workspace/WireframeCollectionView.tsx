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
import { RecordList, TablePropertyControls, type RecordPropertyDefinition, type TableRecord, useTablePropertyConfiguration } from "../../table-kit";
import { RecordUtilities } from "../../components/RecordUtilities";
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
  onCreateRecord?: () => void | Promise<void>;
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
  const [sort, setSort] = useState("");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(24);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
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
  const matchingRecords = useMemo(
    () =>
      config.records.filter((record) =>
        config.searchValues(record).some((value) => value.toLowerCase().includes(query.trim().toLowerCase())) &&
        (!filter || config.cardStatus(record) === filter),
      ),
    [config, filter, query],
  );
  const sortedRecords = useMemo(() => {
    if (!sort) return matchingRecords;
    return [...matchingRecords].sort((left, right) => {
      const leftValue = sort === "title" ? config.cardTitle(left) : sort === "status" ? config.cardStatus(left) : config.cardMeta(left);
      const rightValue = sort === "title" ? config.cardTitle(right) : sort === "status" ? config.cardStatus(right) : config.cardMeta(right);
      const result = leftValue.localeCompare(rightValue, undefined, { numeric: true });
      return direction === "asc" ? result : -result;
    });
  }, [config, direction, matchingRecords, sort]);
  const pageCount = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const visibleRecords = sortedRecords.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const propertyOptions = useMemo(() => {
    const first = config.records[0] as Record<string, unknown> | undefined;
    return first ? Object.keys(first).map((id) => ({ id, label: id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase()), defaultVisible: id !== "id" })) : [];
  }, [config.records]);
  const propertyConfiguration = useTablePropertyConfiguration({ properties: propertyOptions });
  const visiblePropertyIds = propertyConfiguration.visibleIds;
  const resetPage = () => setPageIndex(0);
  const closeInspector = () => {
    setSelectedID(null);
    if (inspectorExpanded) navigate(location.pathname.replace(/\/record\/[^/]+$/, ""));
    requestAnimationFrame(() => selectedCardRef.current?.focus());
  };
  const openRecordPage = () => {
    if (selected) navigate(`${location.pathname.replace(/\/record\/[^/]+$/, "")}/record/${encodeURIComponent(selected.id)}`);
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
      <WireframePageView title={config.title} description={config.description} recordCount={sortedRecords.length}>
        <div className="demo-toolbar">
          <div className="demo-view-tabs" role="tablist" aria-label={`${config.title} view mode`}>
            {(["table", "list", "gallery"] as const).map((mode) => (
              <button className={view === mode ? "active" : ""} type="button" role="tab" aria-selected={view === mode} aria-label={`${mode[0].toUpperCase() + mode.slice(1)} view`} title={`${mode[0].toUpperCase() + mode.slice(1)} view`} onClick={() => setView(mode)} key={mode}>
                {mode === "table" ? <Table2 size={18} aria-hidden="true" /> : mode === "list" ? <List size={18} aria-hidden="true" /> : <GalleryHorizontal size={18} aria-hidden="true" />}
              </button>
            ))}
          </div>
          {searchOpen ? <label className="demo-collection-search"><span aria-hidden="true">⌕</span><input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} aria-label={`Search ${config.title}`} placeholder="Search this collection…" /></label> : <button type="button" className="demo-filter" aria-label="Search records" title="Search records" onClick={() => setSearchOpen(true)}>⌕</button>}
          <RecordUtilities label={config.title} search={query} onSearch={(value) => { setQuery(value); resetPage(); }} sort={sort} onSort={(value) => { setSort(value); resetPage(); }} direction={direction} onDirection={() => setDirection((value) => value === "asc" ? "desc" : "asc")} filter={filter} onFilter={(value) => { setFilter(value); resetPage(); }} sortOptions={[{ value: "title", label: "Name" }, { value: "status", label: "Status" }, { value: "meta", label: "Metadata" }]} filterOptions={[...new Set(config.records.map((record) => config.cardStatus(record)))]} compact />
          <TablePropertyControls properties={propertyOptions} configuration={propertyConfiguration} />
          {config.onCreateRecord ? <button type="button" className="demo-sort" onClick={() => void config.onCreateRecord?.()}>＋ New record</button> : null}
        </div>
        {visibleRecords.length === 0 ? (
          <div className="wireframe-empty-state" role="status">
            <strong>No {config.title.toLowerCase()} records found</strong>
            <p>Try a different search.</p>
          </div>
        ) : (
          <div className={`demo-results demo-${view}`} role="list" aria-label={`${config.title} records`}>
            {view === "table" ? <WireframeAgGrid records={visibleRecords} visiblePropertyIds={visiblePropertyIds} onRecordSelect={setSelectedID} /> : view === "list" ? <WireframeMvpList config={config} records={visibleRecords} visiblePropertyIds={visiblePropertyIds} onRecordSelect={setSelectedID} /> : visibleRecords.map((record, index) => (
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
      {!inspectorExpanded && pageCount > 1 ? <nav className="wireframe-pagination" aria-label={`${config.title} pages`}><button type="button" disabled={pageIndex === 0} onClick={() => setPageIndex((page) => page - 1)}>Previous</button><span>{pageIndex + 1} of {pageCount}</span><button type="button" disabled={pageIndex >= pageCount - 1} onClick={() => setPageIndex((page) => page + 1)}>Next</button><label>Rows <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetPage(); }}><option value="12">12</option><option value="24">24</option><option value="48">48</option></select></label></nav> : null}
      {selected ? (
        inspectorExpanded ? null : <aside
          className={`wireframe-demo-inspector ${inspectorExpanded ? "is-expanded" : ""}`}
          aria-labelledby="wireframe-inspector-title"
        >
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
  visiblePropertyIds,
  onRecordSelect,
}: {
  config: WireframeCollectionConfig<T>;
  records: readonly T[];
  visiblePropertyIds: readonly string[];
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
    ? Object.keys(first).filter((field) => field !== "id" && visiblePropertyIds.includes(field)).map((field) => ({
        id: field,
        label: field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase()),
        kind: isImageProperty(field, first[field]) ? "image" : typeof first[field] === "number" ? "number" : "text",
        getValue: (record) => isImageProperty(field, record[field])
          ? { raw: record[field], display: "", image: { src: String(record[field]), alt: field } }
          : { raw: record[field], display: record[field] == null ? "—" : String(record[field]) },
      }))
    : [];
  return <RecordList records={tableRecords} properties={properties} onExpansionChange={(id) => id && onRecordSelect(String(id))} />;
}

function WireframeAgGrid<T extends WireframeRecord>({ records, visiblePropertyIds, onRecordSelect }: { records: readonly T[]; visiblePropertyIds: readonly string[]; onRecordSelect: (id: string) => void }) {
  const first = records[0] as Record<string, unknown> | undefined;
  const fields = first ? Object.keys(first).filter((field) => field === "id" || visiblePropertyIds.includes(field)) : [];
  const columns: ColDef<T>[] = fields.map((field) => ({
    field: field as keyof T & string,
    headerName: field,
    flex: 1,
    minWidth: 140,
    valueFormatter: ({ value }) => formatWireframeTableValue(field, value),
    cellRenderer: ({ value }) => isImageProperty(field, value) ? <img className="wireframe-table-image" src={String(value)} alt={`${field} preview`} /> : undefined,
  }));
  return <div className="wireframe-ag-grid"><AgGridReact<T> theme={themeQuartz} rowData={[...records]} columnDefs={columns} getRowId={({ data }) => data.id} onRowClicked={({ data }) => data && onRecordSelect(data.id)} domLayout="autoHeight" /></div>;
}

function isImageProperty(field: string, value: unknown): boolean {
  return typeof value === "string" && /(^|_|-)(image|logo|avatar|cover|photo|thumbnail)(s|$)/i.test(field.replace(/([a-z])([A-Z])/g, "$1_$2"));
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
