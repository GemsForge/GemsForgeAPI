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
import { Avatar, H3, ListItem, Paragraph, SizableText, Text, XStack, YGroup, YStack } from "tamagui";
import { GCheckboxField, GemButton } from "../components/ui";
import { TableContext } from "./context";
import { GalleryViewControls, type GalleryCardSize } from "./GalleryViewControls";
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
}: {
  record: TableRecord<unknown>;
  selection: RendererSelection;
  compact?: boolean;
}) {
  if (!selection.onRecordSelect) return null;
  const selected = selection.selectedIds.has(record.id);
  const title = String(record.title ?? record.id);
  return (
    <GCheckboxField
      label=""
      width="short"
      value={selected}
      disabled={!selection.isSelectable(record.id)}
      aria-label={`${selected ? "Deselect" : "Select"} ${title}`}
      aria-checked={selected}
      data-selected={selected}
      alignSelf="center"
      flexShrink={0}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
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

/** Keep title and image metadata in the list header instead of repeating it as rows. */
function listPropertiesFor<Record>(
  properties: readonly RecordPropertyDefinition<Record>[],
  propertyIds?: readonly string[],
) {
  return propertiesFor(properties, propertyIds)
    .filter((property) => {
      const label = property.label.trim().toLowerCase();
      const id = property.id.trim().toLowerCase();
      return (
        property.kind !== "title" &&
        property.kind !== "image" &&
        label !== "name" &&
        label !== "image" &&
        id !== "name" &&
        id !== "image"
      );
    })
    .slice(0, 2);
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

function RecordImage<Record>({
  image,
  fitMedia,
  objectPosition,
}: {
  image?: TableRecord<Record>["image"];
  fitMedia?: boolean;
  objectPosition?: string;
}) {
  if (!image?.src?.trim()) return null;
  return (
    <Avatar circular={false} width="100%" height="100%" borderRadius={0}>
      <Avatar.Image
        src={image.src}
        alt={image.alt}
        width="100%"
        height="100%"
        style={{
          objectFit: fitMedia ? "contain" : "cover",
          objectPosition,
          display: "block",
        }}
      />
    </Avatar>
  );
}

type GalleryCardOptions = { dragToReposition: boolean };

/**
 * Keep card-action state and handlers available while the visual menu stays hidden.
 * The menu is blocked until its interaction contract is finalized, but hiding it
 * must not discard the preserved per-card drag behavior.
 */
const galleryCardActionsVisible = false;

/** Render the shared list icon slot as media when available, with a stable symbol fallback. */
function RecordAvatar<Record>({ record }: { record: TableRecord<Record> }) {
  const image = record.image?.src?.trim() ? record.image : undefined;
  return (
    <Avatar
      size={64}
      accessibilityLabel={`${String(record.title ?? record.id)} icon`}
      backgroundColor="$gemPanelLight"
      borderRadius="$4"
    >
      {image && <Avatar.Image src={image.src} accessibilityLabel={image.alt} objectFit={image.fit ?? "cover"} />}
      {!image && (
        <Avatar.Fallback backgroundColor="$gemPanelLight" alignItems="center" justifyContent="center">
          <SizableText fontSize="$9" lineHeight={1} color="$gemMint">
            {record.icon}
          </SizableText>
        </Avatar.Fallback>
      )}
    </Avatar>
  );
}

function PropertyValue({ value }: { value: RecordPropertyValue }) {
  return <Paragraph color="$gemMuted">{displayValue(value)}</Paragraph>;
}

/** Render a property value through AG Grid without changing the record contract. */
function GridPropertyCell({ value }: ICellRendererParams<TableRecord<unknown>>) {
  return <span>{value ?? "unconfigured"}</span>;
}

/** Render Tamagui list items with distinct open and multi-select gestures. */
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
  const visibleProperties = listPropertiesFor(properties, propertyIds);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current);
    },
    [],
  );
  return (
    <YGroup className="table-kit-record-list" role="list" gap="$2">
      {effectiveRecords.map((record) => {
        const selected = selection.selectedIds.has(record.id);
        return (
          <YGroup.Item key={record.id}>
            <ListItem
              aria-label={`Open ${String(record.title ?? record.id)}${selected ? ", selected" : ""}`}
              data-selected={selected}
              tabIndex={0}
              gap="$3"
              padding="$4"
              minHeight={104}
              borderWidth={1}
              borderColor={selected ? "$gemMint" : "$gemPanelLight"}
              borderRadius="$4"
              backgroundColor="$gemPanel"
              title={record.title ?? record.subtitle ?? record.id}
              subTitle={
                record.subtitle ?? (
                  <YStack gap="$1">
                    {visibleProperties.slice(0, 2).map((property) => (
                      <PropertyValue key={property.id} value={propertyValue(property, record)} />
                    ))}
                  </YStack>
                )
              }
              icon={() => <RecordAvatar record={record} />}
              iconAfter={
                <SizableText color="$gemMuted" fontSize="$8" aria-hidden="true">
                  ›
                </SizableText>
              }
              onClick={(event) => {
                if (event.detail > 1) return;
                if (openTimer.current) clearTimeout(openTimer.current);
                // Defer opening until the double-click window closes so selection does not also open the view.
                openTimer.current = setTimeout(() => onExpansionChange?.(record.id), 250);
              }}
              onDoubleClick={() => {
                if (openTimer.current) clearTimeout(openTimer.current);
                if (selection.isSelectable(record.id)) selection.onRecordSelect?.(record.id);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                if (event.shiftKey && selection.isSelectable(record.id)) selection.onRecordSelect?.(record.id);
                else if (!event.shiftKey) onExpansionChange?.(record.id);
              }}
            >
              {record.status && <SizableText aria-label={record.status.label}>{record.status.label}</SizableText>}
            </ListItem>
          </YGroup.Item>
        );
      })}
    </YGroup>
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
  const [cardSize, setCardSize] = useState<GalleryCardSize>("small");
  const [fillMedia, setFillMedia] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<TableRecordId | null>(null);
  const [cardOptions, setCardOptions] = useState<{ [id: string]: GalleryCardOptions }>({});
  const [imagePositions, setImagePositions] = useState<{ [id: string]: { x: number; y: number } }>({});
  const imageDragRef = useRef<{ id: TableRecordId; x: number; y: number; startX: number; startY: number } | null>(null);
  const visibleProperties = propertiesFor(properties, propertyIds);
  const dragStartRef = useRef<{ index: number; x: number; y: number } | null>(null);
  const dragSelectedIdsRef = useRef<Set<TableRecordId>>(new Set());
  const suppressClickRef = useRef(false);
  const detailClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuCardWasSelectedRef = useRef(false);

  useEffect(() => {
    if (openMenuId !== null && menuCardWasSelectedRef.current && !selection.selectedIds.has(openMenuId)) {
      setOpenMenuId(null);
    }
  }, [openMenuId, selection.selectedIds]);

  /** Use the adapter image first, then allow an image property to supply the cover. */
  const getImage = (record: TableRecord<Record>) =>
    (record.image?.src?.trim() ? record.image : undefined) ??
    visibleProperties.map((property) => propertyValue(property, record).image).find((image) => Boolean(image?.src));

  /** Keep the card surface keyboard-equivalent to a mouse click without nesting buttons. */
  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, record: TableRecord<Record>) => {
    if (!onExpansionChange || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onExpansionChange(expandedId === record.id ? undefined : record.id);
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
    const startRecord = effectiveRecords[start.index];
    if (startRecord && !dragSelectedIdsRef.current.has(startRecord.id)) {
      selection.onRecordSelect(startRecord.id);
      dragSelectedIdsRef.current.add(startRecord.id);
    }
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

  const handleImagePointerDown = (event: ReactPointerEvent<HTMLDivElement>, id: TableRecordId) => {
    if (!cardOptions[id]?.dragToReposition || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const position = imagePositions[id] ?? { x: 50, y: 50 };
    imageDragRef.current = { id, x: position.x, y: position.y, startX: event.clientX, startY: event.clientY };
  };

  const handleImagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = imageDragRef.current;
    if (!drag) return;
    event.stopPropagation();
    setImagePositions((current) => ({
      ...current,
      [drag.id]: {
        x: Math.max(0, Math.min(100, drag.x - (event.clientX - drag.startX) / 3)),
        y: Math.max(0, Math.min(100, drag.y - (event.clientY - drag.startY) / 3)),
      },
    }));
  };

  const handleImagePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (imageDragRef.current) event.stopPropagation();
    imageDragRef.current = null;
  };

  const handleCardClick = (record: TableRecord<Record>, expanded: boolean) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (detailClickTimerRef.current) clearTimeout(detailClickTimerRef.current);
    detailClickTimerRef.current = setTimeout(() => {
      onExpansionChange?.(expanded ? undefined : record.id);
      detailClickTimerRef.current = null;
    }, 250);
  };

  const updateCardOption = (id: TableRecordId, option: keyof GalleryCardOptions, checked: boolean) => {
    setCardOptions((current) => {
      const options = current[id] ?? { dragToReposition: false };
      return {
        ...current,
        [id]: {
          ...options,
          [option]: checked,
        },
      };
    });
  };

  return (
    <div className={`table-kit-gallery is-${cardSize}`}>
      <GalleryViewControls
        cardSize={cardSize}
        fillMedia={fillMedia}
        onCardSizeChange={setCardSize}
        onFillMediaChange={setFillMedia}
      />
      <XStack flexWrap="wrap" gap="$3" role="list" aria-label="Gallery records">
        {effectiveRecords.map((record) => {
          const selected = selection.selectedIds.has(record.id);
          const expanded = expandedId === record.id;
          const title = String(record.title ?? record.id);
          const image = getImage(record);
          const options = cardOptions[record.id] ?? { dragToReposition: false };
          return (
            <div
              key={record.id}
              className={`table-kit-gallery-card${selected ? " is-selected" : ""}${expanded ? " is-expanded" : ""}`}
              role="listitem"
              data-gallery-record-id={record.id}
            >
              {galleryCardActionsVisible && (
                <div className="table-kit-gallery-card-menu">
                  <GemButton
                    type="button"
                    variant="quiet"
                    className="table-kit-gallery-card-menu-trigger"
                    aria-label={`Card options for ${title}`}
                    aria-expanded={openMenuId === record.id}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuId((current) => {
                        if (current === record.id) {
                          menuCardWasSelectedRef.current = false;
                          return null;
                        }
                        menuCardWasSelectedRef.current = selection.selectedIds.has(record.id);
                        return record.id;
                      });
                    }}
                  >
                    <Text color="$gemInk" fontSize="$6" lineHeight={1} aria-hidden>
                      ⋮
                    </Text>
                  </GemButton>
                  {openMenuId === record.id && (
                    <div
                      className="table-kit-gallery-card-menu-panel"
                      role="menu"
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <GCheckboxField
                        label="Drag to reposition"
                        value={options.dragToReposition}
                        width="medium"
                        onChange={(checked) => updateCardOption(record.id, "dragToReposition", checked)}
                      />
                    </div>
                  )}
                </div>
              )}
              <YStack
                className="table-kit-gallery-card-surface"
                role={onExpansionChange ? "button" : undefined}
                tabIndex={onExpansionChange ? 0 : undefined}
                aria-label={onExpansionChange ? `Open ${title}` : undefined}
                onClick={() => handleCardClick(record, expanded)}
                onDoubleClick={() => {
                  if (detailClickTimerRef.current) clearTimeout(detailClickTimerRef.current);
                  detailClickTimerRef.current = null;
                  selection.onRecordSelect?.(record.id);
                }}
                onKeyDown={(event) => handleCardKeyDown(event, record)}
                onPointerDown={(event) => handlePointerDown(event, effectiveRecords.indexOf(record))}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
              >
                <YStack
                  className={`table-kit-gallery-image${options.dragToReposition ? " is-draggable" : ""}`}
                  aspectRatio={1}
                  width="100%"
                  overflow="hidden"
                  backgroundColor="$gemCanvas"
                  aria-label={`${title} image preview`}
                  onPointerDown={(event) => handleImagePointerDown(event, record.id)}
                  onPointerMove={handleImagePointerMove}
                  onPointerUp={handleImagePointerUp}
                  onPointerCancel={handleImagePointerUp}
                >
                  <RecordImage
                    image={image}
                    fitMedia={!fillMedia}
                    objectPosition={
                      imagePositions[record.id]
                        ? `${imagePositions[record.id].x}% ${imagePositions[record.id].y}%`
                        : undefined
                    }
                  />
                </YStack>
                <YStack className="table-kit-gallery-copy" gap="$2" padding="$3">
                  <H3 className="table-kit-gallery-title" aria-label={title}>
                    {title}
                  </H3>
                  {record.subtitle && (
                    <Text className="table-kit-gallery-subtitle" aria-label={record.subtitle}>
                      {record.subtitle}
                    </Text>
                  )}
                  {record.status && <Text className="table-kit-gallery-status">{record.status.label}</Text>}
                  <YStack className="table-kit-gallery-properties" aria-label="Visible properties" gap="$1">
                    {visibleProperties
                      .filter((property) => !property.primary && property.kind !== "image" && property.id !== "logo")
                      .slice(0, 6)
                      .map((property) => {
                        const value = propertyValue(property, record);
                        const text = String(value.display || "unconfigured");
                        return (
                          <Text
                            key={property.id}
                            className="table-kit-gallery-property"
                            aria-label={`${property.label}: ${text}`}
                          >
                            {text}
                          </Text>
                        );
                      })}
                  </YStack>
                </YStack>
              </YStack>
              {expanded && renderExpanded?.(record.source)}
            </div>
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
  const primaryProperty = properties.find((property) => property.primary) ?? visibleProperties[0];
  const hasLogo = visibleProperties.some((property) => property.kind === "image" || property.id === "logo");
  const columnDefs: ColDef<TableRecord<Record>>[] = [];

  if (selection.onRecordSelect) {
    columnDefs.push({
      colId: "selection",
      headerName: "",
      width: 52,
      minWidth: 52,
      maxWidth: 52,
      pinned: "left",
      sortable: false,
      resizable: false,
      cellRenderer: ({ data }: ICellRendererParams<TableRecord<Record>>) =>
        data ? <SelectionButton record={data} selection={selection} /> : null,
    });
  }

  columnDefs.push(
    ...visibleProperties.map<ColDef<TableRecord<Record>>>((property) => ({
      colId: property.id,
      headerName: property.label,
      flex: 1,
      minWidth: 140,
      pinned:
        property === primaryProperty || (hasLogo && (property.kind === "image" || property.id === "logo"))
          ? "left"
          : undefined,
      sortable: property.sortable ?? false,
      valueGetter: ({ data }) => (data ? displayValue(propertyValue(property, data)) : ""),
      cellRenderer: GridPropertyCell,
    })),
  );

  if (hasStatus) {
    columnDefs.push({
      colId: "status",
      headerName: "Status",
      flex: 1,
      minWidth: 120,
      valueGetter: ({ data }) => data?.status?.label ?? "—",
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
        rowClassRules={{
          "table-kit-record-row-selected": ({ data }) => Boolean(data && selection.selectedIds.has(data.id)),
        }}
        defaultColDef={{ flex: 1, minWidth: 140, resizable: true }}
        onRowClicked={({ data }) => {
          if (data && onExpansionChange) onExpansionChange(data.id);
        }}
        domLayout="autoHeight"
        animateRows={false}
        suppressCellFocus
      />
    </YStack>
  );
}
