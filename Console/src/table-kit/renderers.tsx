import {
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { Card, Image, SizableText, XStack, YStack } from "tamagui";
import { TableContext } from "./context";
import {
  orderRecordProperties,
  type RecordPropertyDefinition,
  type RecordPropertyValue,
  type TableRecord,
  type TableRecordId,
} from "./recordContracts";

// Register the free Community modules once so every Table Kit grid shares the same engine setup.
ModuleRegistry.registerModules([AllCommunityModule]);

/** Shared props for all database renderers, backed by the canonical record contract. */
export interface TableRendererProps<Record> {
  /** Omit records when the renderer should consume the nearest Table.Root rows. */
  records?: readonly TableRecord<Record>[];
  properties: readonly RecordPropertyDefinition<Record>[];
  propertyIds?: readonly string[];
  selectedIds?: ReadonlySet<TableRecordId>;
  expandedId?: TableRecordId;
  onRecordSelect?: (id: TableRecordId) => void;
  onExpansionChange?: (id: TableRecordId | undefined) => void;
  renderExpanded?: (record: Record) => ReactNode;
  /** Hide the metadata status column when status is already a record property. */
  showStatus?: boolean;
}

interface RendererSelection {
  selectedIds: ReadonlySet<TableRecordId>;
  onRecordSelect?: (id: TableRecordId) => void;
  addRecords?: (ids: readonly TableRecordId[]) => void;
  isSelectable: (id: TableRecordId) => boolean;
}

/** Resolve selection from the nearest Table.Root while preserving standalone renderer compatibility. */
function useRendererSelection(
  selectedIds: ReadonlySet<TableRecordId> | undefined,
  onRecordSelect: ((id: TableRecordId) => void) | undefined,
): RendererSelection {
  const context = useContext(TableContext);
  const scopedSelection = context?.selection.enabled ? context.selection : undefined;
  return {
    selectedIds: scopedSelection?.selectedIds ?? selectedIds ?? new Set<TableRecordId>(),
    onRecordSelect: scopedSelection?.toggle ?? onRecordSelect,
    addRecords: scopedSelection?.add,
    isSelectable: scopedSelection ? (id) => scopedSelection.currentPageIds.includes(id) : () => true,
  };
}

/** Resolve the effective result set from the scoped root when a renderer is composed as a view slot. */
function useRendererRecords<Record>(
  records: readonly TableRecord<Record>[] | undefined,
): readonly TableRecord<Record>[] {
  const context = useContext(TableContext);
  if (records) return records;
  if (!context) throw new Error("Table Kit record renderers need records or a Table.Root");
  return context.rows as readonly TableRecord<Record>[];
}

function SelectionButton({
  record,
  selection,
  compact = false,
}: {
  record: TableRecord<unknown>;
  selection: RendererSelection;
  compact?: boolean;
}) {
  if (!selection.onRecordSelect) return null;
  const selected = selection.selectedIds.has(record.id);
  const title = String(record.title ?? record.id);
  return (
    <button
      type="button"
      aria-label={`${selected ? "Deselect" : "Select"} ${title}`}
      aria-pressed={selected}
      disabled={!selection.isSelectable(record.id)}
      onClick={() => selection.onRecordSelect?.(record.id)}
    >
      {compact ? (selected ? "Deselect" : "Select") : selected ? `Deselect ${title}` : `Select ${title}`}
    </button>
  );
}

/** Render the compact checkbox used by the table's leading selection column. */
function SelectionCheckbox({ record, selection }: { record: TableRecord<unknown>; selection: RendererSelection }) {
  if (!selection.onRecordSelect) return null;
  const selected = selection.selectedIds.has(record.id);
  const title = String(record.title ?? record.id);
  return (
    <input
      type="checkbox"
      aria-label={`${selected ? "Deselect" : "Select"} ${title}`}
      checked={selected}
      disabled={!selection.isSelectable(record.id)}
      onChange={() => selection.onRecordSelect?.(record.id)}
    />
  );
}

function propertiesFor<Record>(
  properties: readonly RecordPropertyDefinition<Record>[],
  propertyIds?: readonly string[],
) {
  const allowed = propertyIds ? new Set(propertyIds) : undefined;
  return orderRecordProperties(properties).filter(
    (property) => property.visible !== false && (!allowed || allowed.has(property.id)),
  );
}

function propertyValue<Record>(
  property: RecordPropertyDefinition<Record>,
  record: TableRecord<Record>,
): RecordPropertyValue {
  return property.getValue(record.source);
}

function displayValue(value: RecordPropertyValue): ReactNode {
  return value.display || "unconfigured";
}

function RecordImage<Record>({ image, size }: { image?: TableRecord<Record>["image"]; size: number }) {
  if (!image?.src?.trim()) return null;
  return (
    <Image
      source={{ uri: image.src }}
      accessibilityLabel={image.alt}
      width={size}
      height={size}
      objectFit={image.fit ?? "cover"}
    />
  );
}

function PropertyValue({ value }: { value: RecordPropertyValue }) {
  return (
    <SizableText className="table-kit-gallery-property-value" size="$1" color="$gemMuted">
      {displayValue(value)}
    </SizableText>
  );
}

/** Render a property value through AG Grid without changing the record contract. */
function GridPropertyCell({ value }: ICellRendererParams<TableRecord<unknown>>) {
  return <span>{value ?? "unconfigured"}</span>;
}

interface GridActionCellParams<Record> extends ICellRendererParams<TableRecord<Record>> {
  selection: RendererSelection;
  onExpansionChange?: (id: TableRecordId) => void;
}

/** Keep row actions connected to the scoped Table.Root selection context. */
function GridActionCell<Record>({ data, selection }: GridActionCellParams<Record>) {
  if (!data) return null;
  return (
    <XStack justifyContent="center" alignItems="center">
      <SelectionCheckbox record={data} selection={selection} />
    </XStack>
  );
}

/** Renders records as a compact, accessible list using Tamagui layout primitives. */
export function RecordList<Record>({
  records,
  properties,
  propertyIds,
  selectedIds,
  onRecordSelect,
  onExpansionChange,
}: TableRendererProps<Record>) {
  const effectiveRecords = useRendererRecords(records);
  const selection = useRendererSelection(selectedIds, onRecordSelect);
  // The primary property is already rendered as the list title; do not repeat it below.
  const visibleProperties = propertiesFor(properties, propertyIds).filter((property) => !property.primary).slice(0, 1);
  return (
    <YStack role="list" gap="$2">
      {effectiveRecords.map((record) => {
        const selected = selection.selectedIds.has(record.id);
        return (
          <XStack
            key={record.id}
            role="listitem"
            className="table-kit-record-list-row"
            gap="$2"
            padding="$2"
            borderWidth={1}
            borderColor={selected ? "$gemMint" : "$gemPanelLight"}
            borderRadius="$4"
            backgroundColor="$gemPanel"
            alignItems="center"
            tabIndex={onExpansionChange ? 0 : undefined}
            onClick={() => onExpansionChange?.(record.id)}
            onDoubleClick={() => {
              if (selection.onRecordSelect && selection.isSelectable(record.id)) {
                selection.onRecordSelect(record.id);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") onExpansionChange?.(record.id);
            }}
          >
            <div className="table-kit-record-list-icon">
              <RecordImage image={record.image} size={36} />
            </div>
            <YStack flex={1} minWidth={0} gap="$1">
              <SizableText className="table-kit-record-list-title" fontWeight="700" size="$2">
                {record.title ?? record.subtitle ?? record.id}
              </SizableText>
              {visibleProperties.map((property) => (
                <PropertyValue key={property.id} value={propertyValue(property, record)} />
              ))}
            </YStack>
            {record.status && (
              <span
                className={`table-kit-record-list-status is-${record.status.tone ?? "default"}`}
                aria-label={record.status.label}
              >
                {record.status.label}
              </span>
            )}
          </XStack>
        );
      })}
    </YStack>
  );
}

/** Renders records as responsive cards with stable image sizing and ordered properties. */
export function RecordGallery<Record>({
  records,
  properties,
  propertyIds,
  selectedIds,
  onRecordSelect,
  onExpansionChange,
  expandedId,
  renderExpanded,
}: TableRendererProps<Record>) {
  const effectiveRecords = useRendererRecords(records);
  const selection = useRendererSelection(selectedIds, onRecordSelect);
  // Start collections compact so more records fit in the initial gallery view.
  const [cardSize, setCardSize] = useState<"small" | "medium" | "large">("small");
  const visibleProperties = propertiesFor(properties, propertyIds);
  const dragStartRef = useRef<{ index: number; x: number; y: number } | null>(null);
  const dragSelectedIdsRef = useRef<Set<TableRecordId>>(new Set());
  const suppressClickRef = useRef(false);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    },
    [],
  );

  /** Use only the record's dedicated image-file field for the gallery cover. */
  const getImage = (record: TableRecord<Record>) => (record.image?.src?.trim() ? record.image : undefined);

  /** Make keyboard activation open the record, matching the primary card action. */
  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, record: TableRecord<Record>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onExpansionChange?.(expandedId === record.id ? undefined : record.id);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>, index: number) => {
    if (!selection.onRecordSelect || event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStartRef.current = { index, x: event.clientX, y: event.clientY };
    dragSelectedIdsRef.current = new Set(selection.selectedIds);
    suppressClickRef.current = false;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || !selection.onRecordSelect) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8) return;
    suppressClickRef.current = true;
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-gallery-record-id]");
    const targetId = target?.dataset.galleryRecordId;
    const targetIndex = effectiveRecords.findIndex((record) => record.id === targetId);
    if (targetIndex < 0) return;
    const [from, to] = start.index <= targetIndex ? [start.index, targetIndex] : [targetIndex, start.index];
    const idsToAdd: TableRecordId[] = [];
    effectiveRecords.slice(from, to + 1).forEach((record) => {
      if (!dragSelectedIdsRef.current.has(record.id)) {
        idsToAdd.push(record.id);
        dragSelectedIdsRef.current.add(record.id);
      }
    });
    if (idsToAdd.length > 0) {
      if (selection.addRecords) selection.addRecords(idsToAdd);
      else idsToAdd.forEach((id) => selection.onRecordSelect?.(id));
    }
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    dragStartRef.current = null;
  };

  return (
    <div className={`table-kit-gallery is-${cardSize}`}>
      <label className="table-kit-gallery-size">
        Card size
        <select value={cardSize} onChange={(event) => setCardSize(event.target.value as typeof cardSize)}>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </label>
      <XStack flexWrap="wrap" gap="$3" role="list" aria-label="Gallery records">
        {effectiveRecords.map((record) => {
          const selected = selection.selectedIds.has(record.id);
          const expanded = expandedId === record.id;
          const title = String(record.title ?? record.id);
          const image = getImage(record);
          return (
            <Card
              key={record.id}
              className={`table-kit-gallery-card${selected ? " is-selected" : ""}${expanded ? " is-expanded" : ""}`}
              role="listitem"
              data-gallery-record-id={record.id}
            >
              <div
                className="table-kit-gallery-card-surface"
                role={selection.onRecordSelect || onExpansionChange ? "button" : undefined}
                tabIndex={selection.onRecordSelect || onExpansionChange ? 0 : undefined}
                aria-label={`Open ${title}`}
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }
                  if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
                  clickTimerRef.current = setTimeout(() => {
                    onExpansionChange?.(expanded ? undefined : record.id);
                    clickTimerRef.current = null;
                  }, 220);
                }}
                onDoubleClick={() => {
                  if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
                  clickTimerRef.current = null;
                  if (selection.onRecordSelect && selection.isSelectable(record.id))
                    selection.onRecordSelect(record.id);
                }}
                onKeyDown={(event) => handleCardKeyDown(event, record)}
                onPointerDown={(event) => handlePointerDown(event, effectiveRecords.indexOf(record))}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
              >
                <div className="table-kit-gallery-image" aria-label={`${title} image preview`}>
                  {image && (
                    <Image
                      source={{ uri: image.src }}
                      accessibilityLabel={image.alt}
                      width="100%"
                      height="100%"
                      objectFit="contain"
                    />
                  )}
                </div>
                <div className="table-kit-gallery-copy">
                  <div className="table-kit-gallery-title" title={title}>
                    {title}
                  </div>
                  {record.subtitle && (
                    <div className="table-kit-gallery-subtitle" title={record.subtitle}>
                      {record.subtitle}
                    </div>
                  )}
                  {record.status && <span className="table-kit-gallery-status">{record.status.label}</span>}
                  <div className="table-kit-gallery-properties" aria-label="Visible properties">
                    {visibleProperties.map((property) => {
                      const value = propertyValue(property, record);
                      const text = String(value.display || "unconfigured");
                      return (
                        <div
                          key={property.id}
                          className="table-kit-gallery-property"
                          aria-label={`${property.label}: ${text}`}
                          title={text}
                        >
                          <PropertyValue value={value} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {expanded && renderExpanded?.(record.source)}
            </Card>
          );
        })}
      </XStack>
    </div>
  );
}

/** Renders records with AG Grid and mirrors Table Kit selection in the row visual state. */
export function RecordTable<Record>({
  records,
  properties,
  propertyIds,
  selectedIds,
  onRecordSelect,
  onExpansionChange,
  showStatus = true,
}: TableRendererProps<Record>) {
  const effectiveRecords = useRendererRecords(records);
  const selection = useRendererSelection(selectedIds, onRecordSelect);
  const visibleProperties = propertiesFor(properties, propertyIds);
  const hasStatus = showStatus && effectiveRecords.some((record) => record.status !== undefined);
  const hasActions = Boolean(selection.onRecordSelect);
  const imageProperties = visibleProperties.filter((property) => property.kind === "image");
  const primaryProperty =
    visibleProperties.find((property) => property.primary) ??
    visibleProperties.find((property) => property.kind !== "image");
  const orderedProperties = [
    ...imageProperties,
    ...(primaryProperty ? [primaryProperty] : []),
    ...visibleProperties.filter((property) => property.kind !== "image" && property.id !== primaryProperty?.id),
  ];
  const propertyColumns = orderedProperties.map<ColDef<TableRecord<Record>>>((property) => ({
    colId: property.id,
    headerName: property.label,
    flex: 1,
    minWidth: property.kind === "image" ? 72 : 140,
    maxWidth: property.kind === "image" ? 96 : undefined,
    sortable: property.sortable ?? false,
    valueGetter: ({ data }) => (data ? displayValue(propertyValue(property, data)) : ""),
    cellRenderer: GridPropertyCell,
  }));

  const columnDefs: ColDef<TableRecord<Record>>[] = [];
  if (hasActions) {
    columnDefs.push({
      colId: "selection",
      headerName: "",
      width: 56,
      minWidth: 56,
      maxWidth: 56,
      pinned: "left",
      sortable: false,
      resizable: false,
      cellRenderer: GridActionCell,
      cellRendererParams: { selection },
    });
  }

  const imageColumnIds = new Set(imageProperties.map((property) => property.id));
  const imageColumns = propertyColumns.filter((column) => imageColumnIds.has(String(column.colId)));
  const primaryColumn = propertyColumns.find((column) => column.colId === primaryProperty?.id);
  const remainingColumns = propertyColumns.filter(
    (column) => !imageColumnIds.has(String(column.colId)) && column.colId !== primaryProperty?.id,
  );

  imageColumns.forEach((column) => {
    column.pinned = "left";
  });
  if (primaryColumn) primaryColumn.pinned = "left";
  columnDefs.push(...imageColumns);
  if (primaryColumn) columnDefs.push(primaryColumn);

  if (hasStatus) {
    columnDefs.push({
      colId: "status",
      headerName: "Status",
      flex: 1,
      minWidth: 120,
      valueGetter: ({ data }) => data?.status?.label ?? "—",
    });
  }
  columnDefs.push(...remainingColumns);

  return (
    <YStack
      role="region"
      aria-label="Records"
      borderWidth={1}
      borderColor="$gemPanelLight"
      borderRadius="$4"
      overflow="hidden"
    >
      <AgGridReact<TableRecord<Record>>
        aria-label="Records table"
        className="table-kit-record-grid"
        containerStyle={{ width: "100%" }}
        theme={themeQuartz}
        columnDefs={columnDefs}
        rowData={[...effectiveRecords]}
        getRowId={({ data }) => data.id}
        defaultColDef={{ flex: 1, minWidth: 140, resizable: true }}
        rowClassRules={{
          "is-selected": ({ data }) => Boolean(data && selection.selectedIds.has(data.id)),
        }}
        onRowClicked={(event) => {
          const target = event.event?.target;
          if (target instanceof Element && target.closest("input,button")) return;
          if (event.data && onExpansionChange) onExpansionChange(event.data.id);
        }}
        onRowDoubleClicked={(event) => {
          if (event.data && selection.onRecordSelect && selection.isSelectable(event.data.id)) {
            selection.onRecordSelect(event.data.id);
          }
        }}
        domLayout="autoHeight"
        animateRows={false}
        suppressCellFocus
      />
    </YStack>
  );
}
