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
function GridActionCell<Record>({ data, selection, onExpansionChange }: GridActionCellParams<Record>) {
  if (!data) return null;
  return (
    <XStack gap="$2" alignItems="center">
      <SelectionButton record={data} selection={selection} />
      {onExpansionChange && (
        <button
          type="button"
          aria-label={`Expand ${String(data.title ?? data.id)}`}
          onClick={() => onExpansionChange(data.id)}
        >
          View
        </button>
      )}
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
  const visibleProperties = propertiesFor(properties, propertyIds).slice(0, 2);
  return (
    <YStack role="list" gap="$2">
      {effectiveRecords.map((record) => {
        const selected = selection.selectedIds.has(record.id);
        return (
          <XStack
            key={record.id}
            role="listitem"
            gap="$3"
            padding="$3"
            borderWidth={1}
            borderColor={selected ? "$gemMint" : "$gemPanelLight"}
            borderRadius="$4"
            backgroundColor="$gemPanel"
            alignItems="center"
          >
            <RecordImage image={record.image} size={48} />
            <YStack flex={1} gap="$1">
              <SizableText fontWeight="700">{record.title ?? record.subtitle ?? record.id}</SizableText>
              {visibleProperties.map((property) => (
                <PropertyValue key={property.id} value={propertyValue(property, record)} />
              ))}
            </YStack>
            {record.status && <SizableText aria-label={record.status.label}>{record.status.label}</SizableText>}
            <SelectionButton record={record} selection={selection} />
            {onExpansionChange && (
              <button
                type="button"
                aria-label={`Expand ${String(record.title ?? record.id)}`}
                onClick={() => onExpansionChange(record.id)}
              >
                View
              </button>
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
  const [cardSize, setCardSize] = useState<"small" | "medium" | "large">("medium");
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
              {image && (
                <Card.Background alignItems="center" justifyContent="center">
                  <Image
                    source={{ uri: image.src }}
                    accessibilityLabel={image.alt}
                    width="100%"
                    height="100%"
                    objectFit="contain"
                    opacity={0.72}
                  />
                  <YStack
                    position="absolute"
                    top={0}
                    right={0}
                    bottom={0}
                    left={0}
                    backgroundColor="$gemCanvas"
                    opacity={0.42}
                  />
                </Card.Background>
              )}
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
                <div className="table-kit-gallery-image" aria-label={`${title} image preview`} />
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

/** Renders records with AG Grid while keeping the Table Kit contract engine-neutral. */
export function RecordTable<Record>({
  records,
  properties,
  propertyIds,
  selectedIds,
  onRecordSelect,
  onExpansionChange,
}: TableRendererProps<Record>) {
  const effectiveRecords = useRendererRecords(records);
  const selection = useRendererSelection(selectedIds, onRecordSelect);
  const visibleProperties = propertiesFor(properties, propertyIds);
  const hasStatus = effectiveRecords.some((record) => record.status !== undefined);
  const hasActions = Boolean(selection.onRecordSelect || onExpansionChange);
  const columnDefs = visibleProperties.map<ColDef<TableRecord<Record>>>((property) => ({
    colId: property.id,
    headerName: property.label,
    flex: 1,
    minWidth: 140,
    sortable: property.sortable ?? false,
    valueGetter: ({ data }) => (data ? displayValue(propertyValue(property, data)) : ""),
    cellRenderer: GridPropertyCell,
  }));

  if (hasStatus) {
    columnDefs.push({
      colId: "status",
      headerName: "Status",
      flex: 1,
      minWidth: 120,
      valueGetter: ({ data }) => data?.status?.label ?? "—",
    });
  }

  if (hasActions) {
    columnDefs.push({
      colId: "actions",
      headerName: "Actions",
      minWidth: onExpansionChange ? 180 : 150,
      sortable: false,
      resizable: false,
      cellRenderer: GridActionCell,
      cellRendererParams: { selection, onExpansionChange },
    });
  }

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
        domLayout="autoHeight"
        animateRows={false}
        suppressCellFocus
      />
    </YStack>
  );
}
