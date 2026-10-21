import { useContext, type ReactNode } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { Image, Paragraph, SizableText, XStack, YStack } from "tamagui";
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

function RecordImage<Record>({ record, size }: { record: TableRecord<Record>; size: number }) {
  if (!record.image) return null;
  return record.image.src ? (
    <Image
      source={{ uri: record.image.src }}
      accessibilityLabel={record.image.alt}
      width={size}
      height={size}
      objectFit={record.image.fit ?? "cover"}
    />
  ) : (
    <YStack
      width={size}
      height={size}
      alignItems="center"
      justifyContent="center"
      backgroundColor="$gemPanelLight"
      aria-label={record.image.alt}
    >
      <SizableText color="$gemMuted">{record.image.alt}</SizableText>
    </YStack>
  );
}

function PropertyValue({ value }: { value: RecordPropertyValue }) {
  return <Paragraph color="$gemMuted">{displayValue(value)}</Paragraph>;
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
            <RecordImage record={record} size={48} />
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
  return (
    <XStack flexWrap="wrap" gap="$3" role="list">
      {effectiveRecords.map((record) => {
        const selected = selection.selectedIds.has(record.id);
        const expanded = expandedId === record.id;
        const visibleProperties = propertiesFor(properties, propertyIds);
        return (
          <YStack
            key={record.id}
            role="listitem"
            flexBasis={280}
            flexGrow={1}
            maxWidth={420}
            minWidth={240}
            overflow="hidden"
            borderWidth={1}
            borderColor={selected ? "$gemMint" : "$gemPanelLight"}
            borderRadius="$4"
            backgroundColor="$gemPanel"
          >
            <YStack height={180} alignItems="center" justifyContent="center" backgroundColor="$gemCanvas">
              <RecordImage record={record} size={180} />
            </YStack>
            <YStack padding="$3" gap="$2">
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText fontWeight="700">{record.title ?? record.id}</SizableText>
                {record.status && <SizableText aria-label={record.status.label}>{record.status.label}</SizableText>}
              </XStack>
              {visibleProperties.map((property) => (
                <XStack key={property.id} justifyContent="space-between" gap="$2">
                  <SizableText color="$gemMuted">{property.label}</SizableText>
                  <PropertyValue value={propertyValue(property, record)} />
                </XStack>
              ))}
              {(selection.onRecordSelect || onExpansionChange) && (
                <XStack gap="$2">
                  <SelectionButton record={record} selection={selection} compact />
                  {onExpansionChange && (
                    <button type="button" onClick={() => onExpansionChange(expanded ? undefined : record.id)}>
                      {expanded ? "Hide" : "View"}
                    </button>
                  )}
                </XStack>
              )}
              {expanded && renderExpanded?.(record.source)}
            </YStack>
          </YStack>
        );
      })}
    </XStack>
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
