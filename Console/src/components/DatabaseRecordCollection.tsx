import { useCallback, useMemo, useState } from "react";
import { PaginationControls } from "./PaginationControls";
import { RecordUtilities } from "./RecordUtilities";
import { useGemLifeShell } from "./layout/GemLifeShell";
import type { RecordSortDirection } from "../hooks/useRecordUtilities";
import {
  RecordGallery,
  RecordList,
  RecordTable,
  Table,
  useTableContext,
  useTablePropertyConfiguration,
  type RecordAdapter,
  type RecordPropertyDefinition,
  type TableActionsProps,
  type TableRecord,
} from "../table-kit";
import { usePagedRecords } from "../hooks/usePagedRecords";
import type { ReactNode } from "react";

/** The existing domain utility state shared by each database consumer adapter. */
export interface DatabaseRecordUtilities<Record> {
  records: readonly Record[];
  search: string;
  onSearch: (value: string) => void;
  sort: string;
  onSort: (value: string) => void;
  direction: RecordSortDirection;
  onDirection: () => void;
  filter: string;
  onFilter: (value: string) => void;
}

export interface DatabaseRecordCollectionProps<Record> {
  label: string;
  records: readonly Record[];
  utilities: DatabaseRecordUtilities<Record>;
  adapter: RecordAdapter<Record>;
  sortOptions: { value: string; label: string }[];
  filterOptions?: string[];
  detailId: string | null;
  onDetailChange: (id: string | null) => void;
  detail?: ReactNode;
  /** Optional consumer-owned create and intake actions rendered in the utility row. */
  actions?: TableActionsProps;
}

/**
 * Compose the shared Table Kit views around one consumer-owned effective result
 * set. Querying and domain detail remain outside the toolkit, while selection,
 * view switching, property visibility, and pagination share one root context.
 */
export function DatabaseRecordCollection<Record>({
  label,
  records,
  utilities,
  adapter,
  sortOptions,
  filterOptions = [],
  detailId,
  onDetailChange,
  detail,
  actions,
}: DatabaseRecordCollectionProps<Record>) {
  const paging = usePagedRecords(utilities.records);
  const properties = useMemo(() => adapter.getPropertyDefinitions(), [adapter]);
  const pageRecords = useMemo(
    () => paging.items.map((record, index) => adapter.toTableRecord(record, index)),
    [adapter, paging.items],
  );
  const matchingRecords = useMemo(
    () => utilities.records.map((record, index) => adapter.toTableRecord(record, index)),
    [adapter, utilities.records],
  );
  const columns = useMemo(
    () =>
      properties.map((property) => ({
        id: property.id,
        header: property.label,
        cell: (record: TableRecord<Record>) => property.getValue(record.source).display,
      })),
    [properties],
  );

  return (
    <Table.Root
      rows={pageRecords}
      columns={columns}
      rowKey={(record) => record.id}
      caption={`${label} records`}
      views={[
        { id: "list", label: "List", icon: "☷" },
        { id: "gallery", label: "Gallery", icon: "▦" },
        { id: "table", label: "Table", icon: "▤" },
      ]}
      defaultViewId="list"
      selection={{ matchingIds: matchingRecords.map((record) => record.id) }}
    >
      <DatabaseRecordTableShell
        properties={properties}
        label={label}
        utilities={utilities}
        records={records}
        sortOptions={sortOptions}
        filterOptions={filterOptions}
        paging={paging}
        detailId={detailId}
        onDetailChange={onDetailChange}
        detail={detail}
        actions={actions}
      />
    </Table.Root>
  );
}

/** Keep the compact utility row and renderer on one view-scoped configuration. */
function DatabaseRecordTableShell<Record>({
  properties,
  label,
  utilities,
  records,
  sortOptions,
  filterOptions,
  paging,
  detailId,
  onDetailChange,
  detail,
  actions,
}: {
  properties: readonly RecordPropertyDefinition<Record>[];
  label: string;
  utilities: DatabaseRecordUtilities<Record>;
  records: readonly Record[];
  sortOptions: { value: string; label: string }[];
  filterOptions: string[];
  paging: ReturnType<typeof usePagedRecords<Record>>;
  detailId: string | null;
  onDetailChange: (id: string | null) => void;
  detail?: ReactNode;
  actions?: TableActionsProps;
}) {
  const { viewId } = useTableContext<TableRecord<Record>>();
  const propertyOptions = useMemo(
    () =>
      properties.map((property) => ({
        id: property.id,
        label: property.label,
        defaultVisible: property.visible !== false,
      })),
    [properties],
  );
  const galleryPropertyIds = useMemo(
    () =>
      properties
        .filter((property) => !property.primary && property.kind !== "image" && property.id !== "logo")
        .map((property) => property.id),
    [properties],
  );
  const galleryDefaultConfiguration = useMemo(() => ({ hiddenIds: galleryPropertyIds.slice(5) }), [galleryPropertyIds]);
  const configuration = useTablePropertyConfiguration({
    properties: propertyOptions,
    viewId,
    defaultConfiguration: viewId === "gallery" ? galleryDefaultConfiguration : undefined,
  });
  const galleryConfiguration = useMemo(() => {
    if (viewId !== "gallery") return configuration;
    const galleryVisibleIds = configuration.visibleIds
      .filter((propertyId) => {
        const property = properties.find((candidate) => candidate.id === propertyId);
        return property && !property.primary && property.kind !== "image" && property.id !== "logo";
      })
      .slice(0, 6);
    return {
      ...configuration,
      visibleIds: galleryVisibleIds,
      setVisibility: (propertyId: string, visible: boolean) => {
        if (visible && galleryVisibleIds.length >= 6) return;
        configuration.setVisibility(propertyId, visible);
      },
    };
  }, [configuration, properties, viewId]);
  const shell = useGemLifeShell();
  const utilityConfig = actions?.newRecordUtility;
  const [utilityOpen, setUtilityOpen] = useState(utilityConfig?.open ?? false);
  const handleUtilityChange = useCallback(
    (open: boolean) => {
      setUtilityOpen(open);
      shell.setUtilityOpen(open);
      utilityConfig?.onOpenChange?.(open);
    },
    [shell, utilityConfig],
  );
  const resolvedActions = utilityConfig
    ? {
        ...actions,
        newRecordUtility: {
          ...utilityConfig,
          open: utilityOpen,
          onOpenChange: handleUtilityChange,
        },
      }
    : actions;

  return (
    <>
      <Table.Header>
        <div className="table-kit-header-controls">
          <Table.Views />
          <Table.Toolbar>
            <Table.PropertyControls
              properties={propertyOptions}
              configuration={galleryConfiguration}
              maxVisibleProperties={viewId === "gallery" ? 6 : undefined}
            />
            <RecordUtilities
              label={label}
              {...utilities}
              totalCount={records.length}
              visibleCount={utilities.records.length}
              sortOptions={sortOptions}
              filterOptions={filterOptions}
              compact
            />
            {resolvedActions && <Table.Actions {...resolvedActions} />}
          </Table.Toolbar>
        </div>
      </Table.Header>
      <Table.Selection />
      <Table.Content>
        <DatabaseRecordRenderer
          properties={properties}
          propertyIds={galleryConfiguration.visibleIds}
          label={label}
          detailId={detailId}
          onDetailChange={onDetailChange}
          detail={detail}
        />
      </Table.Content>
      <Table.Pagination>
        <PaginationControls {...paging} label={label} />
      </Table.Pagination>
    </>
  );
}

function DatabaseRecordRenderer<Record>({
  properties,
  propertyIds,
  label,
  detailId,
  onDetailChange,
  detail,
}: {
  properties: readonly RecordPropertyDefinition<Record>[];
  propertyIds: readonly string[];
  label: string;
  detailId: string | null;
  onDetailChange: (id: string | null) => void;
  detail?: ReactNode;
}) {
  const { viewId } = useTableContext<TableRecord<Record>>();
  const onExpansionChange = (id: string | undefined) => onDetailChange(id === detailId ? null : (id ?? null));

  return (
    <>
      <div className="database-record-renderer" aria-label={`${label} view`}>
        {viewId === "gallery" ? (
          <RecordGallery properties={properties} propertyIds={propertyIds} onExpansionChange={onExpansionChange} />
        ) : viewId === "table" ? (
          <RecordTable properties={properties} propertyIds={propertyIds} onExpansionChange={onExpansionChange} />
        ) : (
          <RecordList properties={properties} propertyIds={propertyIds} onExpansionChange={onExpansionChange} />
        )}
      </div>
      {detail ? <div className="database-record-detail">{detail}</div> : null}
    </>
  );
}
