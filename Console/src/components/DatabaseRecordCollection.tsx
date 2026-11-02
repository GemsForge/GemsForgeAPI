import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type SavedTableViewInput } from "../api";
import { PaginationControls } from "./PaginationControls";
import { RecordUtilities } from "./RecordUtilities";
import { useGemLifeShell } from "./layout/GemLifeShell";
import type { RecordSortDirection } from "../hooks/useRecordUtilities";
import {
  RecordGallery,
  RecordList,
  RecordTable,
  Table,
  TableSettingsMenu,
  useTableContext,
  useTablePropertyConfiguration,
  type RecordAdapter,
  type RecordPropertyDefinition,
  type RecordPropertyValue,
  type TableActionsProps,
  type TableRecord,
} from "../table-kit";
import { usePagedRecords } from "../hooks/usePagedRecords";
import type { TablePropertyConfigurationInput } from "../table-kit/configuration";
import type { ReactNode } from "react";
import { Dialog } from "tamagui";
import { GemButton } from "./ui";

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
  onRecordPatch?: (record: Record, field: string, value: string | number | null) => Promise<void>;
}

type CollectionWorkspaceState = {
  activeViewId: "list" | "gallery" | "table";
  selectedRecordId: string | null;
};

function decodeCollectionWorkspaceState(value: string | null): CollectionWorkspaceState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<CollectionWorkspaceState>;
    if (
      (parsed.activeViewId === "list" || parsed.activeViewId === "gallery" || parsed.activeViewId === "table") &&
      (parsed.selectedRecordId === null || typeof parsed.selectedRecordId === "string")
    )
      return parsed as CollectionWorkspaceState;
  } catch {
    // Ignore workspace state from an incompatible or older client.
  }
  return null;
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
  onRecordPatch,
}: DatabaseRecordCollectionProps<Record>) {
  const [activeViewId, setActiveViewId] = useState<"list" | "gallery" | "table">("gallery");
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(null);
  const [viewConfigurations, setViewConfigurations] = useState<
    globalThis.Record<string, TablePropertyConfigurationInput>
  >({});
  const workspaceStateRef = useRef<CollectionWorkspaceState>({
    activeViewId: "gallery",
    selectedRecordId: null,
  });
  const handleDetailChange = useCallback((id: string | null) => {
    setPendingSelectionId(null);
    onDetailChange(id);
  }, [onDetailChange]);
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
  useEffect(() => {
    const controller = new AbortController();
    const viewTypes = [
      ["list", "List"],
      ["gallery", "Gallery"],
      ["table", "Table"],
    ] as const;
    void Promise.all(
      viewTypes.map(async ([viewId, viewType]) => {
        try {
          const saved = await api.getTableView(label, viewType, controller.signal);
          return [viewId, saved] as const;
        } catch {
          return null;
        }
      }),
    ).then((savedViews) => {
      if (controller.signal.aborted) return;
      setViewConfigurations((current) =>
        savedViews.reduce(
          (next, savedView) =>
            savedView
              ? {
                  ...next,
                  [savedView[0]]: {
                    order: savedView[1].columns.map((column) => column.columnName),
                    hiddenIds: savedView[1].columns
                      .filter((column) => !column.isVisible)
                      .map((column) => column.columnName),
                  },
                }
              : next,
          current,
        ),
      );
      const restored = savedViews
        .filter((savedView): savedView is Exclude<typeof savedView, null> => savedView !== null)
        .map(([, saved]) => ({ saved, state: decodeCollectionWorkspaceState(saved.view.workspaceState) }))
        .filter((candidate) => candidate.state !== null)
        .sort(
          (left, right) => Date.parse(right.saved.view.updatedAt ?? "") - Date.parse(left.saved.view.updatedAt ?? ""),
        )[0];
      if (restored?.state) {
        workspaceStateRef.current = restored.state;
        setActiveViewId(restored.state.activeViewId);
        if (restored.state.selectedRecordId === null) {
          setPendingSelectionId(null);
          onDetailChange(null);
        } else {
          setPendingSelectionId(restored.state.selectedRecordId);
        }
      }
      setWorkspaceLoaded(true);
    });
    return () => controller.abort();
  }, [label]);

  useEffect(() => {
    if (!pendingSelectionId) return;
    const recordIsAvailable = records.some(
      (record, index) => adapter.toTableRecord(record, index).id === pendingSelectionId,
    );
    if (recordIsAvailable) handleDetailChange(pendingSelectionId);
  }, [adapter, handleDetailChange, pendingSelectionId, records]);

  const saveConfiguration = useCallback(
    async (
      viewId: string | undefined,
      configuration: { order: readonly string[]; hiddenIds: readonly string[] },
      selectedRecordId: string | null = detailId,
    ) => {
      if (!viewId) return;
      const viewType = viewId === "gallery" ? "Gallery" : viewId === "table" ? "Table" : "List";
      const payload: SavedTableViewInput = {
        viewType,
        name: viewId,
        workspaceState: JSON.stringify({ activeViewId: viewId, selectedRecordId }),
        columns: configuration.order.map((columnName, sortOrder) => ({
          columnName,
          sortOrder,
          isVisible: !configuration.hiddenIds.includes(columnName),
          width: null,
        })),
        queries: [],
      };
      setViewConfigurations((current) => ({ ...current, [viewId]: configuration }));
      try {
        await api.saveTableView(label, viewType, payload);
      } catch {
        // Keep the local change usable when the API is unavailable; the next change retries persistence.
      }
    },
    [detailId, label],
  );

  useEffect(() => {
    if (!workspaceLoaded || pendingSelectionId !== null) return;
    const nextState: CollectionWorkspaceState = { activeViewId, selectedRecordId: detailId };
    if (
      workspaceStateRef.current.activeViewId === nextState.activeViewId &&
      workspaceStateRef.current.selectedRecordId === nextState.selectedRecordId
    )
      return;
    workspaceStateRef.current = nextState;
    const viewType = activeViewId === "gallery" ? "Gallery" : activeViewId === "table" ? "Table" : "List";
    void api.saveTableViewWorkspaceState(label, viewType, JSON.stringify(nextState)).catch(() => {
      // Keep navigation responsive if persistence is temporarily unavailable.
    });
  }, [activeViewId, detailId, label, pendingSelectionId, workspaceLoaded]);

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
      viewId={activeViewId}
      onViewChange={(viewId) => {
        if (viewId === "list" || viewId === "gallery" || viewId === "table") setActiveViewId(viewId);
      }}
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
        onDetailChange={handleDetailChange}
        detail={detail}
        actions={actions}
        onRecordPatch={onRecordPatch}
        viewConfigurations={viewConfigurations}
        onConfigurationChange={saveConfiguration}
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
  onRecordPatch,
  viewConfigurations,
  onConfigurationChange,
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
  onRecordPatch?: (record: Record, field: string, value: string | number | null) => Promise<void>;
  viewConfigurations: Readonly<globalThis.Record<string, TablePropertyConfigurationInput>>;
  onConfigurationChange: (
    viewId: string | undefined,
    configuration: { order: readonly string[]; hiddenIds: readonly string[] },
  ) => Promise<void>;
}) {
  const { viewId, setViewId } = useTableContext<TableRecord<Record>>();
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
    viewConfigurations,
    onConfigurationChange: (next, context) => {
      void onConfigurationChange(context.viewId, next);
    },
  });
  const [groupBy, setGroupBy] = useState("");
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
            <TableSettingsMenu
              viewId={viewId as "list" | "gallery" | "table"}
              onViewChange={setViewId}
              properties={propertyOptions}
              propertyConfiguration={galleryConfiguration}
              sort={utilities.sort}
              sortOptions={sortOptions}
              onSort={utilities.onSort}
              direction={utilities.direction}
              onDirection={utilities.onDirection}
              filter={utilities.filter}
              filterOptions={filterOptions}
              onFilter={utilities.onFilter}
              groupBy={groupBy}
              onGroupBy={setGroupBy}
              groupOptions={propertyOptions.map((property) => ({ value: property.id, label: property.label }))}
            />
            <RecordUtilities
              label={label}
              {...utilities}
              totalCount={records.length}
              visibleCount={utilities.records.length}
              sortOptions={sortOptions}
              filterOptions={filterOptions}
              compact
              hideSearch
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
          groupBy={groupBy}
          label={label}
          detailId={detailId}
          onDetailChange={onDetailChange}
          detail={detail}
          onRecordPatch={onRecordPatch}
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
  groupBy,
  label,
  detailId,
  onDetailChange,
  detail,
  onRecordPatch,
}: {
  properties: readonly RecordPropertyDefinition<Record>[];
  propertyIds: readonly string[];
  groupBy: string;
  label: string;
  detailId: string | null;
  onDetailChange: (id: string | null) => void;
  detail?: ReactNode;
  onRecordPatch?: (record: Record, field: string, value: string | number | null) => Promise<void>;
}) {
  const { viewId, rows } = useTableContext<TableRecord<Record>>();
  const [expanded, setExpanded] = useState(false);
  const onExpansionChange = (id: string | undefined) => onDetailChange(id === detailId ? null : (id ?? null));
  const groupProperty = groupBy ? properties.find((property) => property.id === groupBy) : undefined;
  const groups = useMemo(() => {
    if (!groupProperty) return null;
    const grouped = new Map<string, TableRecord<Record>[]>();
    for (const record of rows) {
      const label = getRecordGroupLabel(groupProperty.getValue(record.source));
      const group = grouped.get(label) ?? [];
      group.push(record);
      grouped.set(label, group);
    }
    return [...grouped].map(([label, records]) => ({ label, records }));
  }, [groupProperty, rows]);

  const renderView = (groupRecords?: readonly TableRecord<Record>[]) => {
    const rendererProps = {
      records: groupRecords,
      properties,
      propertyIds,
      onExpansionChange,
    };
    if (viewId === "gallery") return <RecordGallery {...rendererProps} />;
    if (viewId === "table") return <RecordTable {...rendererProps} />;
    return <RecordList {...rendererProps} onRecordPatch={onRecordPatch} />;
  };

  useEffect(() => {
    if (detailId === null) setExpanded(false);
  }, [detailId]);

  return (
    <>
      <div className="database-record-renderer" aria-label={`${label} view`}>
        {groups ? (
          <div className="database-record-groups">
            {groups.map((group) => (
              <section className="database-record-group" key={group.label}>
                <h3 className="database-record-group-heading">
                  <span>{groupProperty?.label}: {group.label}</span>
                  <span className="database-record-group-count">{group.records.length}</span>
                </h3>
                {renderView(group.records)}
              </section>
            ))}
          </div>
        ) : renderView()}
      </div>
      {detail && detailId !== null && !expanded ? (
        <aside className="database-record-inspector" aria-label={`${label} record inspector`}>
          <div className="database-record-inspector-heading">
            <div><span className="eyebrow">Record inspector</span><strong>{label}</strong></div>
            <div className="database-record-inspector-actions">
              <button type="button" aria-label="Expand record into page view" title="Expand record into page view" onClick={() => setExpanded(true)}>↗</button>
              <button type="button" aria-label="Close record inspector" title="Close record inspector" onClick={() => onDetailChange(null)}>×</button>
            </div>
          </div>
          <div className="database-record-detail">{detail}</div>
        </aside>
      ) : null}
      {detail && expanded ? (
        <Dialog open onOpenChange={(open) => !open && setExpanded(false)} modal>
          <Dialog.Portal><Dialog.Overlay className="table-kit-utility-backdrop" /><Dialog.Content className="table-kit-new-record-utility database-record-detail-dialog">
            <Dialog.Title className="sr-only">{label} record page</Dialog.Title>
            <Dialog.Close asChild><GemButton variant="quiet" size="sm" className="database-record-detail-close" aria-label="Close record page" onClick={() => setExpanded(false)}>×</GemButton></Dialog.Close>
            <div className="database-record-detail database-record-page-view">{detail}</div>
          </Dialog.Content></Dialog.Portal>
        </Dialog>
      ) : null}
    </>
  );
}

function getRecordGroupLabel(value: RecordPropertyValue): string {
  if (value.raw === null || value.raw === "") return "Empty";
  if (typeof value.raw === "string" || typeof value.raw === "number" || typeof value.raw === "boolean") {
    return String(value.raw);
  }
  if (value.status?.label) return value.status.label;
  if (typeof value.display === "string" || typeof value.display === "number") {
    return String(value.display).trim() || "Empty";
  }
  return value.raw === undefined ? "Empty" : "Other";
}
