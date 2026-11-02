import React, { cloneElement, isValidElement, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, Expand, GalleryHorizontal, List, Table2 } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, type ColDef, type ColDefField, type ICellRendererParams } from "ag-grid-community";
import { useLiveSchemaQuery } from "../../data/workflowQueries";
import { WireframeLeftPane } from "./WireframeLeftPane";
import { WireframePageView } from "./WireframePageView";
import { WireframeRecordPageView } from "./WireframeRecordPageView";
import { PropertyIcon, PropertyIconPicker } from "./PropertyIconPicker";
import { formatRecordNumber, inferRecordNumberFormat } from "../../table-kit";
import { RecordList, Table, TablePropertyControls, type RecordPropertyDefinition, type TableActionsProps, type TableRecord, useTablePropertyConfiguration } from "../../table-kit";
import { RecordUtilities } from "../../components/RecordUtilities";
import { GalleryViewControls, type GalleryCardSize } from "../../table-kit";
import { useLocation, useNavigate } from "react-router-dom";
import { GSelectField } from "../../components/ui/GSelectField";
import { GemTextField } from "../../components/ui/GemTextField";
import { GemButton } from "../../components/ui/GemButton";
import { SizableText, Theme } from "tamagui";
import { inferRecordPropertyKind, normalizeStorageType } from "../../table-kit/storageTypes";
import { formatAddress } from "../addresses/formatAddress";
import { inferWireframePropertyMetadata, WIREFRAME_PROPERTY_TYPES } from "./propertyMetadata";
import { WireframeCover, type WireframeCover as WireframeCoverValue } from "./WireframeCover";

export type WireframeRecord = { id: string };
export type WireframeCollectionConfig<T extends WireframeRecord> = {
  tableName?: string;
  title: string;
  description: string;
  activeCollection: string;
  records: readonly T[];
  properties?: readonly RecordPropertyDefinition<T>[];
  searchValues: (record: T) => string[];
  cardTitle: (record: T) => string;
  cardSubtitle: (record: T) => string;
  cardStatus: (record: T) => string;
  cardMeta: (record: T) => string;
  cardImage?: (record: T) => { src: string; alt: string } | undefined;
  inspector: (record: T, schemaProperties?: readonly RecordPropertyDefinition<T>[]) => ReactNode;
  onCreateRecord?: () => void | Promise<void>;
  recordActions?: Omit<TableActionsProps, "onNew">;
  newRecordUtility?: TableActionsProps["newRecordUtility"];
  cover?: (record: T) => WireframeCoverValue | null | undefined;
  onCoverChange?: (record: T, cover: WireframeCoverValue | null) => Promise<void> | void;
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
  const [galleryCardSize, setGalleryCardSize] = useState<GalleryCardSize>("small");
  const [galleryFillMedia, setGalleryFillMedia] = useState(true);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(9);
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
  const coverStoragePrefix = `gemsforge:record-cover:${config.tableName ?? config.title}:`;
  const [storedCovers, setStoredCovers] = useState<Record<string, WireframeCoverValue | null>>(() => {
    if (typeof window === "undefined") return {};
    return config.records.reduce<Record<string, WireframeCoverValue | null>>((covers, record) => {
      const raw = window.localStorage.getItem(`${coverStoragePrefix}${record.id}`);
      if (raw) { try { covers[record.id] = JSON.parse(raw) as WireframeCoverValue | null; } catch { /* ignore malformed local cover */ } }
      return covers;
    }, {});
  });
  const selectedCardRef = useRef<HTMLButtonElement | null>(null);
  const recordPageID = location.pathname.match(/\/record\/([^/]+)$/)?.[1];
  const inspectorExpanded = Boolean(recordPageID);
  const selected = config.records.find((record) => record.id === (recordPageID ? decodeURIComponent(recordPageID) : selectedID)) ?? null;
  const selectedCover = selected ? config.cover?.(selected) ?? storedCovers[selected.id] : undefined;
  const persistCover = async (record: T, cover: WireframeCoverValue | null) => {
    setStoredCovers((current) => ({ ...current, [record.id]: cover }));
    window.localStorage.setItem(`${coverStoragePrefix}${record.id}`, JSON.stringify(cover));
    await config.onCoverChange?.(record, cover);
  };
  const schema = schemaQuery.data?.tables.find((table) => table.name === (config.tableName ?? config.title));
  const schemaProperties = useMemo(
    () => schema ? createWireframeSchemaProperties<T>(schema.columns, config.records) : [],
    [config.records, schema],
  );
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
    const ids = new Set(first
      ? Object.entries(first)
          .filter(([, value]) => value == null || ["string", "number", "boolean"].includes(typeof value))
          .map(([id]) => id)
      : []);
    for (const record of config.records) {
      for (const [id, value] of Object.entries(record)) if (isImageProperty(id, value)) ids.add(id);
    }
    for (const property of config.properties ?? []) ids.add(property.sourceField ?? property.id);
    if (config.cardImage) ids.add("image");
    for (const column of schema?.columns ?? []) ids.add(schemaColumnSourceField(column, config.records));
    return [...ids].map((id) => ({
      id,
      label: config.properties?.find((property) => property.id === id || property.sourceField === id)?.label ?? propertyLabel(id),
      defaultVisible: id !== "id",
    }));
  }, [config, schema]);
  const galleryDefaultConfiguration = useMemo(() => {
    const visibleByDefault = new Set(
      propertyOptions
        .filter((property) => property.defaultVisible !== false)
        .slice(0, 5)
        .map((property) => property.id),
    );
    return { hiddenIds: propertyOptions.filter((property) => !visibleByDefault.has(property.id)).map((property) => property.id) };
  }, [propertyOptions]);
  const propertyConfiguration = useTablePropertyConfiguration({
    properties: propertyOptions,
    viewId: view,
    defaultConfiguration: view === "gallery" ? galleryDefaultConfiguration : undefined,
  });
  const visiblePropertyIds = propertyConfiguration.visibleIds;
  const imagePropertyOptions = propertyOptions.filter((property) => isImageProperty(property.id, (config.records[0] as Record<string, unknown> | undefined)?.[property.id]) || property.id === "image");
  const galleryImageProperty = imagePropertyOptions[0]?.id ?? "";
  const resetPage = () => setPageIndex(0);
  const closeInspector = () => {
    setSelectedID(null);
    if (inspectorExpanded) navigate(location.pathname.replace(/\/record\/[^/]+$/, ""));
    requestAnimationFrame(() => selectedCardRef.current?.focus());
  };
  const openRecordPage = () => {
    if (selected) navigate(`${location.pathname.replace(/\/record\/[^/]+$/, "")}/record/${encodeURIComponent(selected.id)}`);
  };
  const openPropertyDetails = (details: { label: string; value: string; type?: string; icon?: string }) => {
    const metadata = inferWireframePropertyMetadata({ label: details.label, propertyType: details.type, iconName: details.icon });
    setPropertyDetails({ ...details, type: metadata.type, icon: metadata.iconName, statusText: details.value, colorToken: "mint" });
  };
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
          cover={<WireframeCover recordKey={selected.id} value={selectedCover} onChange={(cover) => persistCover(selected, cover)} />}
        >
          {renderInspector(config.inspector(selected, schemaProperties), openPropertyDetails)}
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
          <RecordUtilities label={config.title} search={query} onSearch={(value) => { setQuery(value); resetPage(); }} sort={sort} onSort={(value) => { setSort(value); resetPage(); }} direction={direction} onDirection={() => setDirection((value) => value === "asc" ? "desc" : "asc")} filter={filter} onFilter={(value) => { setFilter(value); resetPage(); }} sortOptions={[{ value: "title", label: "Name" }, { value: "status", label: "Status" }, { value: "meta", label: "Metadata" }]} filterOptions={[...new Set(config.records.map((record) => config.cardStatus(record)))]} totalCount={config.records.length} visibleCount={matchingRecords.length} compact />
          <TablePropertyControls
            properties={propertyOptions}
            configuration={propertyConfiguration}
            maxVisibleProperties={view === "gallery" ? 5 : undefined}
          />
          <Theme name="light">
            <Table.Actions
              onNew={config.onCreateRecord}
              {...config.recordActions}
              newRecordUtility={config.newRecordUtility}
              newOptionsLabel="New record options"
              newLabel="New record"
            />
          </Theme>
        </div>
        {view === "gallery" ? (
          <GalleryViewControls
            cardSize={galleryCardSize}
            fillMedia={galleryFillMedia}
            wireframe
            onCardSizeChange={setGalleryCardSize}
            onFillMediaChange={setGalleryFillMedia}
          />
        ) : null}
        {visibleRecords.length === 0 ? (
          <div className="wireframe-empty-state" role="status">
            <strong>No {config.title.toLowerCase()} records found</strong>
            <p>Try a different search.</p>
          </div>
        ) : (
          <div className={`demo-results demo-${view} ${view === "gallery" ? `gallery-size-${galleryCardSize}` : ""} ${galleryFillMedia ? "gallery-fill-media" : "gallery-fit-media"}`} role="group" aria-label={`${config.title} records`}>
            {view === "table" ? <WireframeAgGrid records={visibleRecords} visiblePropertyIds={visiblePropertyIds} properties={config.properties} onRecordSelect={setSelectedID} /> : view === "list" ? <WireframeMvpList config={config} records={visibleRecords} visiblePropertyIds={visiblePropertyIds} onRecordSelect={setSelectedID} /> : visibleRecords.map((record, index) => (
              <button
                ref={selectedID === record.id ? selectedCardRef : undefined}
                type="button"
                aria-pressed={selectedID === record.id}
                className={`demo-place-card ${selectedID === record.id ? "selected" : ""}`}
                onClick={() => setSelectedID(record.id)}
                key={record.id}
              >
                {galleryImageSource(record, galleryImageProperty) ?? config.cardImage?.(record)?.src ? (
                  <span className="demo-place-image"><img src={galleryImageSource(record, galleryImageProperty) ?? config.cardImage?.(record)?.src} alt={config.cardImage?.(record)?.alt ?? `${config.cardTitle(record)} image`} /></span>
                ) : (
                  <span className="demo-place-image" style={{ background: `linear-gradient(135deg, ${cardColors[index % cardColors.length]}, #527b82)` }} aria-hidden="true" />
                )}
                <span className="demo-place-copy">
                  <strong>{config.cardTitle(record)}</strong>
                  <small>{config.cardSubtitle(record)}</small>
                  <span className="demo-place-properties" aria-label="Visible properties">
                    {getGalleryCardProperties(record, visiblePropertyIds, config.properties, [config.cardTitle(record), config.cardSubtitle(record), config.cardMeta(record)]).map((property) => (
                      <small className="demo-place-property" aria-label={`${property.label}: ${property.value}`} key={property.id}>
                        {property.value}
                      </small>
                    ))}
                  </span>
                  <small className="demo-place-meta">
                    {config.cardMeta(record)} · {record.id}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}
        <nav className="wireframe-pagination" aria-label={`${config.title} pages`}>
          <GemButton className="wireframe-design-button" type="button" variant="outlined" tone="wireframe" size="xs" aria-label={`Previous page of ${config.title}`} disabled={pageIndex === 0 || sortedRecords.length === 0} onClick={() => setPageIndex((page) => Math.max(0, page - 1))}>Previous</GemButton>
          <span role="status">{sortedRecords.length === 0 ? "0 records" : `${pageIndex * pageSize + 1}–${Math.min(sortedRecords.length, (pageIndex + 1) * pageSize)} of ${sortedRecords.length}`}</span>
        <GSelectField
          label="Records per page"
          value={String(pageSize)}
          width="xs"
          containerClassName="wireframe-pagination-page-size"
          size="$2"
          wireframe
          options={[9, 18, 27].map((size) => ({ value: String(size), label: String(size) }))}
          onChange={(value) => { setPageSize(Number(value)); resetPage(); }}
        />
          <GemButton className="wireframe-design-button" type="button" variant="outlined" tone="wireframe" size="xs" aria-label={`Next page of ${config.title}`} disabled={pageIndex >= pageCount - 1 || sortedRecords.length === 0} onClick={() => setPageIndex((page) => Math.min(pageCount - 1, page + 1))}>Next</GemButton>
        </nav>
      </WireframePageView>
      )}
      {selected ? (
        inspectorExpanded ? null : <aside
          className={`wireframe-demo-inspector ${inspectorExpanded ? "is-expanded" : ""}`}
          aria-labelledby="wireframe-inspector-title"
        >
          <WireframeCover recordKey={selected.id} value={selectedCover} onChange={(cover) => persistCover(selected, cover)} />
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
          {renderInspector(config.inspector(selected, schemaProperties), openPropertyDetails)}
        </aside>
      ) : null}
      {propertyDetails ? (
        <Theme name="light">
        <div className="wireframe-property-details-backdrop" role="presentation" onClick={() => setPropertyDetails(null)}>
          <section
            className="wireframe-property-details"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wireframe-property-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <GemButton type="button" variant="quiet" tone="secondary" aria-label="Close property details" onClick={() => setPropertyDetails(null)}>
              ×
            </GemButton>
            <div className="wireframe-property-details-heading">
              <span className="wireframe-property-details-icon" aria-hidden="true">
                <PropertyIcon name={propertyDetails.icon} />
              </span>
              <div>
                <SizableText id="wireframe-property-details-title" className="wireframe-property-dialog-title" size="$3" fontWeight="700" role="heading" aria-level={2}>Property settings</SizableText>
                <p>{propertyDetails.label}</p>
              </div>
            </div>
            <div className="wireframe-property-details-preview">
              <strong>Current value</strong>
              <p>{propertyDetails.value || "No value recorded."}</p>
            </div>
            <GemTextField
              id="wireframe-property-name"
              label="Property name"
              value={propertyDetails.label}
              readOnly={isIdentityProperty(propertyDetails.label)}
              onChange={(event) => setPropertyDetails({ ...propertyDetails, label: event.currentTarget.value })}
            />
            <GSelectField
              id="wireframe-property-type"
              label="Primitive type"
              value={propertyDetails.type}
              options={[...new Set([...WIREFRAME_PROPERTY_TYPES, propertyDetails.type])].map((type) => ({ value: type, label: type }))}
              onChange={(type) => setPropertyDetails({ ...propertyDetails, type })}
              wireframe
            />
            <fieldset className="wireframe-property-icon-fieldset">
              <legend>Icon</legend>
              <PropertyIconPicker
                value={propertyDetails.icon}
                onChange={(icon) => setPropertyDetails({ ...propertyDetails, icon })}
              />
            </fieldset>
            <GemTextField
              id="wireframe-property-status-text"
              label="Status text"
              value={propertyDetails.statusText}
              onChange={(event) => setPropertyDetails({ ...propertyDetails, statusText: event.currentTarget.value })}
            />
            <GSelectField
              id="wireframe-property-color"
              label="Pill color"
              value={propertyDetails.colorToken}
              options={["mint", "gold", "blue", "green", "purple", "orange", "red", "gray"].map((color) => ({ value: color, label: color[0].toUpperCase() + color.slice(1) }))}
              onChange={(colorToken) => setPropertyDetails({ ...propertyDetails, colorToken })}
              wireframe
            />
            <div className="wireframe-property-details-actions">
              <GemButton type="button" variant="outlined" tone="secondary" onClick={() => setPropertyDetails(null)}>
                Cancel
              </GemButton>
              <GemButton
                type="button"
                aria-label="Save property settings"
                onClick={() => setPropertyDetails(null)}
              >
                ✓
              </GemButton>
            </div>
          </section>
        </div>
        </Theme>
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
    ? visiblePropertyIds.filter((field) => field !== "id").map((field) => {
        const adapted = config.properties?.find((property) => property.id === field || property.sourceField === field);
        if (adapted) return adapted;
        return {
          id: field,
          label: field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase()),
          kind: isImageProperty(field, first[field]) ? "image" : typeof first[field] === "number" ? "number" : "text",
          getValue: (record: T) => isImageProperty(field, (record as Record<string, unknown>)[field])
            ? { raw: (record as Record<string, unknown>)[field], display: "", image: { src: String((record as Record<string, unknown>)[field]), alt: field } }
            : { raw: (record as Record<string, unknown>)[field], display: (record as Record<string, unknown>)[field] == null ? "—" : String((record as Record<string, unknown>)[field]) },
        };
      })
    : [];
  return <RecordList records={tableRecords} properties={properties} onExpansionChange={(id) => id && onRecordSelect(String(id))} />;
}

function WireframeAgGrid<T extends WireframeRecord>({ records, visiblePropertyIds, properties = [], onRecordSelect }: { records: readonly T[]; visiblePropertyIds: readonly string[]; properties?: readonly RecordPropertyDefinition<T>[]; onRecordSelect: (id: string) => void }) {
  const fields = ["id", ...visiblePropertyIds.filter((field) => field !== "id")];
  const columns: ColDef<T>[] = fields.map((field) => {
    const property = properties.find((item) => item.id === field || item.sourceField === field);
    return {
      field: field as ColDefField<T>,
      headerName: property?.label ?? propertyLabel(field),
      flex: 1,
      minWidth: 140,
      valueFormatter: (params) => {
        if (!property || !params.data) return formatWireframeTableValue(field, params.value);
        const display = property.getValue(params.data).display;
        return typeof display === "string" || typeof display === "number" ? String(display) : display == null ? "—" : "";
      },
      cellRenderer: (params: ICellRendererParams<T>) => isImageProperty(field, params.value) ? <img className="wireframe-table-image" src={String(params.value)} alt={`${field} preview`} /> : undefined,
    };
  });
  return <div className="wireframe-ag-grid"><AgGridReact<T> theme={themeQuartz} rowData={[...records]} columnDefs={columns} getRowId={({ data }) => data.id} onRowClicked={({ data }) => data && onRecordSelect(data.id)} domLayout="autoHeight" /></div>;
}

function isImageProperty(field: string, value: unknown): boolean {
  return typeof value === "string" && /(^|_|-)(image|logo|avatar|cover|photo|thumbnail)(s|$)/i.test(field.replace(/([a-z])([A-Z])/g, "$1_$2"));
}

function propertyLabel(id: string): string {
  return id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

export function createWireframeSchemaProperties<T extends WireframeRecord>(
  columns: readonly { name: string; dataType: string; primaryKey: boolean }[],
  records: readonly T[] = [],
): readonly RecordPropertyDefinition<T>[] {
  return columns.map((column, order) => {
    const sourceField = schemaColumnSourceField(column, records);
    return {
      id: sourceField,
      sourceField,
      label: propertyLabel(sourceField),
      storageType: normalizeStorageType(column.dataType),
      kind: inferRecordPropertyKind(column),
      order,
      primary: column.primaryKey,
      getValue: (record) => {
        const raw = (record as Record<string, unknown>)[sourceField];
        if (/^(location|work)AddressID$/i.test(sourceField)) {
          const address = (record as Record<string, unknown>).address;
          const formatted = address && typeof address === "object"
            ? formatAddress(address as Parameters<typeof formatAddress>[0])
            : "Address unavailable";
          return { raw, display: formatted };
        }
        return { raw, display: raw == null || raw === "" ? "—" : String(raw) };
      },
    };
  });
}

function schemaColumnSourceField<T extends WireframeRecord>(
  column: { name: string; primaryKey: boolean },
  records: readonly T[],
): string {
  if (column.primaryKey) return "id";
  if (column.name.toLowerCase() === "dateupdated") return "updatedAt";
  const recordKeys = records.flatMap((record) => Object.keys(record));
  const matchingKey = recordKeys.find((key) => key.toLowerCase() === column.name.toLowerCase());
  return matchingKey ?? column.name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").split(" ").map((part, index) =>
    index === 0 ? part.toLowerCase() : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`,
  ).join("");
}

function galleryImageSource(record: object, property: string): string | undefined {
  if (!property) return undefined;
  if (property === "image" || property === "logo") return undefined;
  const value = (record as Record<string, unknown>)[property];
  if (typeof value === "string") return value.trim() || undefined;
  if (value && typeof value === "object" && "src" in value && typeof value.src === "string") return value.src;
  return undefined;
}

function getGalleryCardProperties<T extends WireframeRecord>(
  record: T,
  visiblePropertyIds: readonly string[],
  properties: readonly RecordPropertyDefinition<T>[] = [],
  repeatedValues: readonly string[] = [],
) {
  const values = record as Record<string, unknown>;
  const seen = new Set(repeatedValues.flatMap((value) => value.split(/[·•|]/).map(normalizeGalleryValue)).filter(Boolean));
  return visiblePropertyIds
    .filter((id) => id !== "id" && (Object.hasOwn(values, id) || properties.some((property) => property.id === id || property.sourceField === id)) && !isImageProperty(id, values[id]))
    .map((id) => {
      const property = properties.find((item) => item.id === id || item.sourceField === id);
      const adapted = property?.getValue(record);
      const rawDisplay = adapted?.display;
      const value = typeof rawDisplay === "string" || typeof rawDisplay === "number"
        ? String(rawDisplay)
        : typeof values[id] === "boolean"
          ? values[id] ? "Yes" : "No"
          : values[id] && typeof values[id] === "object" ? "—" : formatWireframeTableValue(id, values[id]);
      return {
        id,
        label: property?.label ?? id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase()),
        value,
      };
    })
    .filter((property) => {
      const normalized = normalizeGalleryValue(property.value);
      if (!normalized || normalized === "—" || normalized === "unconfigured" || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 5);
}

function normalizeGalleryValue(value: string): string {
  return value.trim().toLocaleLowerCase();
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
      const data = label.props as {
        "data-property-type"?: string;
        "data-property-icon"?: string;
        "data-property-number-format"?: "decimal" | "currency" | "percent";
      };
      const metadata = inferWireframePropertyMetadata({
        label: labelText,
        kind: propertyKind,
        numberFormat: data["data-property-number-format"],
        propertyType: data["data-property-type"],
        iconName: data["data-property-icon"],
      });
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
              onClick={() => onDetails({
                label: labelText,
                value: valueText,
                type: metadata.type,
                icon: metadata.iconName,
              })}
            >
              <PropertyIcon name={metadata.iconName} size={13} />
            </button>
            {labelText}
          </dt>
          {value}
        </>,
      );
    }),
  );
}

function isIdentityProperty(label: string): boolean {
  return /^(id|item id|record id|primary key)$/i.test(label.trim());
}
