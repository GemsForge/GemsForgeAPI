import React, { cloneElement, isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronLeft,
  Archive,
  Expand,
  GalleryHorizontal,
  GripVertical,
  List,
  Menu as MenuIcon,
  Table2,
  X,
} from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, type ColDef, type ColDefField, type ICellRendererParams } from "ag-grid-community";
import { useLiveSchemaQuery } from "../../data/workflowQueries";
import { WireframeLeftPane } from "./WireframeLeftPane";
import { WireframePageView } from "./WireframePageView";
import { WireframeRecordPageView } from "./WireframeRecordPageView";
import { PropertyIcon } from "./PropertyIconPicker";
import { PROPERTY_ICON_LIBRARY, getPropertyIconByName } from "./propertyIcons";
import { formatRecordNumber, inferRecordNumberFormat } from "../../table-kit";
import {
  RecordList,
  Table,
  TableSettingsMenu,
  type RecordPropertyDefinition,
  type TableActionsProps,
  type TablePropertyConfiguration,
  type TableRecord,
  useTablePropertyConfiguration,
} from "../../table-kit";
import { RecordUtilities } from "../../components/RecordUtilities";
import { type GalleryCardSize } from "../../table-kit";
import { useLocation, useNavigate } from "react-router-dom";
import { GSelectField } from "@gemsforge/ui";
import { GemButton } from "@gemsforge/ui";
import { GemStatusPill } from "@gemsforge/ui";
import { GemSectionHeading } from "@gemsforge/ui";
import { Button, Menu as DropdownMenu, Theme } from "tamagui";
import { inferRecordPropertyKind, normalizeStorageType } from "../../table-kit/storageTypes";
import { formatAddress } from "../addresses/formatAddress";
import { inferWireframePropertyMetadata } from "./propertyMetadata";
import { WireframeCover, WireframeCoverCardImage, type WireframeCover as WireframeCoverValue } from "./WireframeCover";
import { WireframePropertyIconProvider } from "./WireframePropertyEditor";
import { WireframePropertySettingsDialog, type WireframePropertyDetails } from "./WireframePropertySettingsDialog";
import { useWireframeNavigation } from "./WireframeAppHeader";
import { api } from "../../api";
import { useUploadImageMutation } from "../../data/workflowQueries";
import { useArchiveRecordMutation, useTrashEntriesQuery } from "../../data/trashQueries";
import {
  useDeleteRecordPresentationMutation,
  useRecordPresentationsQuery,
  useSaveRecordPresentationMutation,
  useSaveTableViewWorkspaceStateMutation,
  useTableViewsQuery,
} from "../../data/presentationQueries";

export type WireframeRecord = { id: string };
type WireframeWorkspaceState = {
  title?: string;
  description?: string;
  activeViewId?: "table" | "list" | "gallery";
  selectedRecordId?: string | null;
  galleryCardSize?: GalleryCardSize;
  galleryFillMedia?: boolean;
  galleryImageSelection?: string;
  query?: string;
  sort?: string;
  direction?: "asc" | "desc";
  filter?: string;
  groupBy?: string;
  pageIndex?: number;
  pageSize?: number;
  tableIcon?: string;
  propertyIcons?: Record<string, string>;
  propertyConfigurations?: Record<string, TablePropertyConfiguration>;
  inspectorPropertyOrder?: string[];
};
export type WireframeCollectionConfig<T extends WireframeRecord> = {
  tableName?: string;
  title: string;
  description: string;
  headerBanner?: ReactNode;
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
  const recordPageID = location.pathname.match(/\/record\/([^/]+)$/)?.[1];
  const tableIconStorageKey = `gemsforge:table-icon:${config.tableName ?? config.title}`;
  const [view, setView] = useState<"table" | "list" | "gallery">("gallery");
  const [tableTitle, setTableTitle] = useState(config.title);
  const [tableDescription, setTableDescription] = useState(config.description);
  const [mobileViewMenuOpen, setMobileViewMenuOpen] = useState(false);
  const [galleryCardSize, setGalleryCardSize] = useState<GalleryCardSize>("small");
  const [galleryFillMedia, setGalleryFillMedia] = useState(true);
  const [galleryImageSelection, setGalleryImageSelection] = useState("__canvas");
  const [tableIcon, setTableIcon] = useState(() => {
    if (typeof window === "undefined") return "Folder";
    return window.localStorage.getItem(tableIconStorageKey) || "Folder";
  });
  const tableIconDirty = useRef(false);
  const [propertyIcons, setPropertyIcons] = useState<Record<string, string>>({});
  const [propertyConfigurations, setPropertyConfigurations] = useState<Record<string, TablePropertyConfiguration>>({});
  const [inspectorPropertyOrder, setInspectorPropertyOrder] = useState<string[]>();
  const [inspectorSortAnnouncement, setInspectorSortAnnouncement] = useState("");
  const [draggedInspectorPropertyID, setDraggedInspectorPropertyID] = useState<string | null>(null);
  const [inspectorDropTargetID, setInspectorDropTargetID] = useState<string | null>(null);
  const draggedInspectorPropertyRef = useRef<string | null>(null);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [workspaceSelectionRevision, setWorkspaceSelectionRevision] = useState(0);
  const workspaceSelectedID = recordPageID ? decodeURIComponent(recordPageID) : selectedID;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState("");
  const [groupBy, setGroupBy] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(9);
  const wireframeNavigation = useWireframeNavigation();
  const [fallbackMobileNavigationOpen, setFallbackMobileNavigationOpen] = useState(false);
  const mobileNavigationOpen = wireframeNavigation?.open ?? fallbackMobileNavigationOpen;
  const setMobileNavigationOpen = wireframeNavigation?.setOpen ?? setFallbackMobileNavigationOpen;
  const fallbackMobileNavigationToggleRef = useRef<HTMLButtonElement>(null);
  const closeMobileNavigation = () => {
    if (wireframeNavigation) {
      wireframeNavigation.close();
      return;
    }
    setFallbackMobileNavigationOpen(false);
    requestAnimationFrame(() => fallbackMobileNavigationToggleRef.current?.focus());
  };
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(384);
  const inspectorResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [propertyDetails, setPropertyDetails] = useState<WireframePropertyDetails | null>(null);
  const propertyDetailsOpen = propertyDetails !== null;
  const propertyDetailsDialogRef = useRef<HTMLElement | null>(null);
  const propertyDetailsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const presentationTableName = config.tableName ?? config.title;
  const trashEntriesQuery = useTrashEntriesQuery();
  const archiveRecord = useArchiveRecordMutation();
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const archivedRecordIDs = useMemo(
    () =>
      new Set(
        (trashEntriesQuery.data ?? [])
          .filter((entry) => entry.tableName === presentationTableName)
          .map((entry) => entry.recordID),
      ),
    [presentationTableName, trashEntriesQuery.data],
  );
  const activeRecords = useMemo(
    () => config.records.filter((record) => !archivedRecordIDs.has(record.id)),
    [archivedRecordIDs, config.records],
  );
  const savedViewsQuery = useTableViewsQuery(presentationTableName);
  const { mutateAsync: saveWorkspaceStateAsync } = useSaveTableViewWorkspaceStateMutation(presentationTableName);
  const workspaceHydrated = useRef(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const pendingSelectedID = useRef<string | null>(null);
  const skipWorkspaceSaveOnce = useRef(false);
  const lastSavedWorkspaceState = useRef("");
  useEffect(() => {
    if (!savedViewsQuery.isSuccess || workspaceHydrated.current) return;
    workspaceHydrated.current = true;
    const candidates = (
      [
        ["List", savedViewsQuery.data.List],
        ["Gallery", savedViewsQuery.data.Gallery],
        ["Table", savedViewsQuery.data.Table],
      ] as const
    )
      .filter((entry) => entry[1]?.view.workspaceState)
      .map((entry) => {
        try {
          return {
            updatedAt: Date.parse(entry[1]!.view.updatedAt ?? ""),
            state: JSON.parse(entry[1]!.view.workspaceState!) as WireframeWorkspaceState,
          };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { updatedAt: number; state: WireframeWorkspaceState } => entry !== null)
      .sort((left, right) => right.updatedAt - left.updatedAt);
    const state = candidates[0]?.state;
    if (!state) {
      setWorkspaceReady(true);
      return;
    }
    // Applying persisted values causes several state updates. Do not let the
    // save effect write the component defaults while those updates settle.
    skipWorkspaceSaveOnce.current = true;
    if (typeof state.title === "string") setTableTitle(state.title);
    if (typeof state.description === "string") setTableDescription(state.description);
    if (state.activeViewId) setView(state.activeViewId);
    if (state.selectedRecordId) pendingSelectedID.current = state.selectedRecordId;
    if (state.galleryCardSize) setGalleryCardSize(state.galleryCardSize);
    if (typeof state.galleryFillMedia === "boolean") setGalleryFillMedia(state.galleryFillMedia);
    if (state.galleryImageSelection) setGalleryImageSelection(state.galleryImageSelection);
    if (typeof state.query === "string") setQuery(state.query);
    if (typeof state.sort === "string") setSort(state.sort);
    if (state.direction) setDirection(state.direction);
    if (typeof state.filter === "string") setFilter(state.filter);
    if (typeof state.groupBy === "string") setGroupBy(state.groupBy);
    if (typeof state.pageIndex === "number") setPageIndex(state.pageIndex);
    if (typeof state.pageSize === "number") setPageSize(state.pageSize);
    if (typeof state.tableIcon === "string" && !tableIconDirty.current) {
      setTableIcon(state.tableIcon);
      window.localStorage.setItem(tableIconStorageKey, state.tableIcon);
    }
    if (state.propertyIcons && typeof state.propertyIcons === "object") {
      setPropertyIcons(
        Object.fromEntries(
          Object.entries(state.propertyIcons).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        ),
      );
    }
    if (state.propertyConfigurations && typeof state.propertyConfigurations === "object") {
      setPropertyConfigurations(state.propertyConfigurations);
    }
    if (Array.isArray(state.inspectorPropertyOrder)) {
      setInspectorPropertyOrder([
        ...new Set(state.inspectorPropertyOrder.filter((id): id is string => typeof id === "string")),
      ]);
    }
    setWorkspaceReady(true);
  }, [savedViewsQuery.data, savedViewsQuery.isSuccess, presentationTableName, tableIconStorageKey]);
  useEffect(() => {
    const pendingID = pendingSelectedID.current;
    if (!pendingID) return;
    pendingSelectedID.current = null;
    skipWorkspaceSaveOnce.current = true;
    if (activeRecords.some((record) => record.id === pendingID)) {
      setSelectedID(pendingID);
      return;
    }
    // The collection is mounted with its loaded record set. Clear the stale
    // selection and trigger a follow-up save after hydration updates settle.
    setSelectedID(null);
    setWorkspaceSelectionRevision((revision) => revision + 1);
  }, [activeRecords, savedViewsQuery.isSuccess]);
  useEffect(() => {
    if (!workspaceHydrated.current || pendingSelectedID.current) return;
    if (skipWorkspaceSaveOnce.current) {
      skipWorkspaceSaveOnce.current = false;
      return;
    }
    const state: WireframeWorkspaceState = {
      title: tableTitle,
      description: tableDescription,
      activeViewId: view,
      selectedRecordId: workspaceSelectedID,
      galleryCardSize,
      galleryFillMedia,
      galleryImageSelection,
      query,
      sort,
      direction,
      filter,
      groupBy,
      pageIndex,
      pageSize,
      tableIcon,
      propertyIcons,
      propertyConfigurations,
      ...(inspectorPropertyOrder ? { inspectorPropertyOrder } : {}),
    };
    const serialized = JSON.stringify(state);
    if (serialized === lastSavedWorkspaceState.current) return;
    const timer = window.setTimeout(() => {
      lastSavedWorkspaceState.current = serialized;
      const viewType = view === "gallery" ? "Gallery" : view === "table" ? "Table" : "List";
      void saveWorkspaceStateAsync({ viewType, workspaceState: serialized }).catch(() => {
        lastSavedWorkspaceState.current = "";
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    tableTitle,
    tableDescription,
    view,
    workspaceSelectedID,
    galleryCardSize,
    galleryFillMedia,
    galleryImageSelection,
    query,
    sort,
    direction,
    filter,
    groupBy,
    pageIndex,
    pageSize,
    tableIcon,
    propertyIcons,
    propertyConfigurations,
    inspectorPropertyOrder,
    workspaceSelectionRevision,
    presentationTableName,
    saveWorkspaceStateAsync,
  ]);
  const presentationsQuery = useRecordPresentationsQuery(presentationTableName);
  const savePresentation = useSaveRecordPresentationMutation(presentationTableName);
  const deletePresentation = useDeleteRecordPresentationMutation(presentationTableName);
  const { mutateAsync: uploadImageAsync } = useUploadImageMutation();
  const storedCovers = useMemo(() => {
    const covers: Record<string, WireframeCoverValue | null> = {};
    for (const item of presentationsQuery.data ?? []) {
      try {
        covers[item.recordID] = JSON.parse(item.presentation) as WireframeCoverValue | null;
      } catch {
        /* ignore malformed persisted presentation */
      }
    }
    return covers;
  }, [presentationsQuery.data]);
  const selectedCardRef = useRef<HTMLButtonElement | null>(null);
  const inspectorExpanded = Boolean(recordPageID);
  const selected =
    activeRecords.find((record) => record.id === (recordPageID ? decodeURIComponent(recordPageID) : selectedID)) ??
    null;
  const selectedCover = selected ? (config.cover?.(selected) ?? storedCovers[selected.id]) : undefined;
  const TableIcon = getPropertyIconByName(tableIcon).icon;
  const updateTableIcon = (value: string) => {
    tableIconDirty.current = true;
    setTableIcon(value);
    window.localStorage.setItem(tableIconStorageKey, value);
  };
  const persistCover = async (record: T, cover: WireframeCoverValue | null) => {
    if (cover) {
      await savePresentation.mutateAsync({ recordID: record.id, presentation: JSON.stringify(cover) });
    } else {
      await deletePresentation.mutateAsync(record.id);
    }
    await config.onCoverChange?.(record, cover);
  };
  const uploadCover = async (record: T, file: File) => {
    const metadata = await uploadImageAsync({
      file,
      kind: "image",
      ownerType: `RecordPresentation.${presentationTableName}`,
      ownerID: record.id,
    });
    return { id: metadata.id, url: api.fileContentURL(metadata.id) };
  };
  const schema = schemaQuery.data?.tables.find((table) => table.name === (config.tableName ?? config.title));
  const schemaProperties = useMemo(
    () => (schema ? createWireframeSchemaProperties<T>(schema.columns, activeRecords) : []),
    [activeRecords, schema],
  );
  const matchingRecords = useMemo(
    () =>
      activeRecords.filter(
        (record) =>
          config.searchValues(record).some((value) => value.toLowerCase().includes(query.trim().toLowerCase())) &&
          (!filter || config.cardStatus(record) === filter),
      ),
    [activeRecords, config, filter, query],
  );
  const sortedRecords = useMemo(() => {
    if (!sort) return matchingRecords;
    return [...matchingRecords].sort((left, right) => {
      const leftValue =
        sort === "title" ? config.cardTitle(left) : sort === "status" ? config.cardStatus(left) : config.cardMeta(left);
      const rightValue =
        sort === "title"
          ? config.cardTitle(right)
          : sort === "status"
            ? config.cardStatus(right)
            : config.cardMeta(right);
      const result = leftValue.localeCompare(rightValue, undefined, { numeric: true });
      return direction === "asc" ? result : -result;
    });
  }, [config, direction, matchingRecords, sort]);
  const pageCount = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const visibleRecords = sortedRecords.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const propertyOptions = useMemo(() => {
    const first = activeRecords[0] as Record<string, unknown> | undefined;
    const ids = new Set(
      first
        ? Object.entries(first)
            .filter(([, value]) => value == null || ["string", "number", "boolean"].includes(typeof value))
            .map(([id]) => id)
        : [],
    );
    for (const record of activeRecords) {
      for (const [id, value] of Object.entries(record)) if (isImageProperty(id, value)) ids.add(id);
    }
    for (const property of config.properties ?? []) ids.add(property.sourceField ?? property.id);
    if (config.cardImage) ids.add("image");
    for (const column of schema?.columns ?? []) ids.add(schemaColumnSourceField(column, activeRecords));
    return [...ids].map((id) => ({
      id,
      label:
        config.properties?.find((property) => property.id === id || property.sourceField === id)?.label ??
        propertyLabel(id),
      defaultVisible: id !== "id",
    }));
  }, [activeRecords, config, schema]);
  const groupProperty = groupBy
    ? (config.properties?.find((property) => property.id === groupBy || property.sourceField === groupBy) ??
      schemaProperties.find((property) => property.id === groupBy || property.sourceField === groupBy))
    : undefined;
  const groupPropertyLabel =
    propertyOptions.find((property) => property.id === groupBy)?.label ?? propertyLabel(groupBy);
  const visibleRecordGroups = useMemo(() => {
    if (!groupBy) return [{ key: "all", label: "", records: visibleRecords }];
    const groups = new Map<string, { label: string; records: T[] }>();
    for (const record of visibleRecords) {
      const propertyValue = groupProperty?.getValue(record);
      const sourceValue = (record as Record<string, unknown>)[groupBy];
      const rawValue = propertyValue?.raw === undefined ? sourceValue : propertyValue.raw;
      const group = getWireframeGroup(rawValue, propertyValue?.status?.label, propertyValue?.display);
      const recordsInGroup = groups.get(group.key)?.records ?? [];
      recordsInGroup.push(record);
      groups.set(group.key, { label: group.label, records: recordsInGroup });
    }
    return [...groups].map(([key, group]) => ({ key, ...group }));
  }, [groupBy, groupProperty, visibleRecords]);
  const galleryDefaultConfiguration = useMemo(() => {
    // Gallery cards already have dedicated title, subtitle, status, and
    // metadata slots. Additional properties should appear only after the user
    // explicitly enables them in Property visibility.
    return { hiddenIds: propertyOptions.map((property) => property.id) };
  }, [propertyOptions]);
  const propertyConfiguration = useTablePropertyConfiguration({
    properties: propertyOptions,
    viewId: view,
    defaultConfiguration: view === "gallery" ? galleryDefaultConfiguration : undefined,
    configuration: propertyConfigurations[view],
    onConfigurationChange: (configuration) => {
      skipWorkspaceSaveOnce.current = false;
      setPropertyConfigurations((current) => ({ ...current, [view]: configuration }));
    },
  });
  const visiblePropertyIds = propertyConfiguration.visibleIds;
  const imagePropertyOptions = propertyOptions.filter(
    (property) =>
      isImageProperty(property.id, (activeRecords[0] as Record<string, unknown> | undefined)?.[property.id]) ||
      property.id === "image",
  );
  const galleryImageOptions = useMemo(
    () => [
      { value: "__canvas", label: "Canvas fallback" },
      { value: "__record-cover", label: "Record cover" },
      ...imagePropertyOptions.map((property) => ({ value: property.id, label: property.label })),
      ...(config.cardImage ? [{ value: "__record-image", label: "Record image" }] : []),
    ],
    [config.cardImage, imagePropertyOptions],
  );
  useEffect(() => {
    const available = new Set(galleryImageOptions.map((option) => option.value));
    if (!available.has(galleryImageSelection)) setGalleryImageSelection("__canvas");
  }, [galleryImageSelection, galleryImageOptions]);
  const resetPage = () => setPageIndex(0);
  const closeInspector = () => {
    setSelectedID(null);
    if (inspectorExpanded) navigate(location.pathname.replace(/\/record\/[^/]+$/, ""));
    requestAnimationFrame(() => selectedCardRef.current?.focus());
  };
  const moveSelectedToTrash = async () => {
    if (!selected) return;
    setArchiveError(null);
    try {
      await archiveRecord.mutateAsync({
        tableName: presentationTableName,
        recordID: selected.id,
        title: config.cardTitle(selected),
        snapshot: JSON.stringify(selected),
      });
      closeInspector();
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "The record could not be moved to Trash.");
    }
  };
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const resize = inspectorResizeRef.current;
      if (!resize) return;
      const nextWidth = resize.startWidth + (resize.startX - event.clientX);
      setInspectorWidth(Math.min(520, Math.max(280, nextWidth)));
    };
    const end = () => {
      inspectorResizeRef.current = null;
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
    };
  }, []);
  const openRecordPage = () => {
    if (selected)
      navigate(`${location.pathname.replace(/\/record\/[^/]+$/, "")}/record/${encodeURIComponent(selected.id)}`);
  };
  const openPropertyDetails = (
    details: { id: string; label: string; value: string; type?: string; icon?: string },
    trigger: HTMLButtonElement,
  ) => {
    propertyDetailsTriggerRef.current = trigger;
    const metadata = inferWireframePropertyMetadata({
      label: details.label,
      propertyType: details.type,
      iconName: details.icon,
    });
    setPropertyDetails({
      ...details,
      type: metadata.type,
      icon: propertyIcons[details.id] ?? metadata.iconName,
      statusText: details.value,
      colorToken: "mint",
    });
  };
  useEffect(() => {
    if (!propertyDetailsOpen) return;
    const dialog = propertyDetailsDialogRef.current;
    if (!dialog) return;
    document.getElementById("wireframe-property-name")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      setPropertyDetails(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (propertyDetailsTriggerRef.current?.isConnected) propertyDetailsTriggerRef.current.focus();
    };
  }, [propertyDetailsOpen]);
  const savePropertyIcon = (propertyID: string, icon: string) => {
    skipWorkspaceSaveOnce.current = false;
    setPropertyIcons((current) => ({ ...current, [propertyID]: icon }));
  };
  const reorderInspectorProperties = (order: string[], announcement: string) => {
    skipWorkspaceSaveOnce.current = false;
    setInspectorPropertyOrder(order);
    setInspectorSortAnnouncement(announcement);
  };
  const inspectorRenderOptions = {
    onDetails: openPropertyDetails,
    propertyDetailsID: propertyDetails?.id ?? null,
    propertyIcons,
    propertyOrder: inspectorPropertyOrder,
    onReorder: reorderInspectorProperties,
    draggedPropertyRef: draggedInspectorPropertyRef,
    draggedPropertyID: draggedInspectorPropertyID,
    dropTargetID: inspectorDropTargetID,
    setDraggedPropertyID: setDraggedInspectorPropertyID,
    setDropTargetID: setInspectorDropTargetID,
    announcement: inspectorSortAnnouncement,
  };
  return (
    <section
      className={`wireframe-demo wireframe-standalone ${inspectorExpanded ? "is-expanded" : ""} ${selected ? "has-inspector" : "inspector-closed"}`}
      style={{ "--inspector-width": `${inspectorWidth}px` } as React.CSSProperties}
      data-schema-table={schema?.name ?? config.tableName ?? config.title}
      aria-labelledby="wireframe-page-title"
    >
      {wireframeNavigation === null ? (
        <button
          type="button"
          ref={fallbackMobileNavigationToggleRef}
          className="wireframe-mobile-nav-toggle"
          aria-label={mobileNavigationOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileNavigationOpen}
          aria-controls="wireframe-navigation"
          onClick={() => setMobileNavigationOpen(!mobileNavigationOpen)}
        >
          {mobileNavigationOpen ? <X size={17} aria-hidden="true" /> : <MenuIcon size={17} aria-hidden="true" />}
          <span>{mobileNavigationOpen ? "Close" : "Navigation"}</span>
        </button>
      ) : null}
      <div
        id="wireframe-navigation"
        className={mobileNavigationOpen ? "wireframe-mobile-nav is-open" : "wireframe-mobile-nav"}
      >
        {mobileNavigationOpen ? (
          <>
            <button
              type="button"
              className="wireframe-nav-backdrop"
              aria-label="Close navigation"
              onClick={closeMobileNavigation}
            />
            {wireframeNavigation === null ? (
              <button
                type="button"
                className="wireframe-nav-close"
                aria-label="Close navigation"
                onClick={closeMobileNavigation}
              >
                <X size={17} aria-hidden="true" />
              </button>
            ) : null}
          </>
        ) : null}
        <WireframeLeftPane
          recordCount={activeRecords.length}
          activeCollection={config.activeCollection}
          activeCollectionTitle={tableTitle}
          activeCollectionIcon={<TableIcon size={16} aria-hidden="true" />}
          collapsed={mobileNavigationOpen ? false : navigationCollapsed}
          onToggleCollapsed={() => setNavigationCollapsed((collapsed) => !collapsed)}
          onCloseNavigation={wireframeNavigation ? closeMobileNavigation : undefined}
          mobileDrawerOpen={mobileNavigationOpen}
        />
      </div>
      {inspectorExpanded && selected ? (
        <WireframeRecordPageView
          collectionTitle={tableTitle}
          recordTitle={config.cardTitle(selected)}
          onBack={() => navigate(location.pathname.replace(/\/record\/[^/]+$/, ""))}
          onClose={closeInspector}
          cover={
            <WireframeCover
              recordKey={selected.id}
              value={selectedCover}
              onChange={(cover) => persistCover(selected, cover)}
              onUpload={(file) => uploadCover(selected, file)}
            />
          }
        >
          <div
            className="wireframe-inspector-resizer"
            aria-label="Resize record inspector"
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-valuemin={280}
            aria-valuemax={520}
            aria-valuenow={inspectorWidth}
            onPointerDown={(event) => {
              event.preventDefault();
              inspectorResizeRef.current = { startX: event.clientX, startWidth: inspectorWidth };
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                setInspectorWidth((width) =>
                  Math.min(520, Math.max(280, width + (event.key === "ArrowLeft" ? 16 : -16))),
                );
              }
            }}
          />
          <WireframePropertyIconProvider onSave={savePropertyIcon}>
            <WireframeInspector node={config.inspector(selected, schemaProperties)} options={inspectorRenderOptions} />
          </WireframePropertyIconProvider>
        </WireframeRecordPageView>
      ) : (
        <WireframePageView
          title={tableTitle}
          description={tableDescription}
          banner={config.headerBanner}
          recordCount={sortedRecords.length}
          tableIcon={<TableIcon size={20} aria-hidden="true" />}
          onTitleChange={workspaceReady ? setTableTitle : undefined}
          onDescriptionChange={workspaceReady ? setTableDescription : undefined}
        >
          <div className="demo-toolbar">
            <div className="demo-view-tabs" role="tablist" aria-label={`${tableTitle} view mode`}>
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
                  {mode === "table" ? (
                    <Table2 size={16} aria-hidden="true" />
                  ) : mode === "list" ? (
                    <List size={16} aria-hidden="true" />
                  ) : (
                    <GalleryHorizontal size={16} aria-hidden="true" />
                  )}
                  <span className="wireframe-view-label">{mode[0].toUpperCase() + mode.slice(1)}</span>
                </button>
              ))}
            </div>
            <DropdownMenu
              open={mobileViewMenuOpen}
              onOpenChange={setMobileViewMenuOpen}
              placement="bottom-start"
              modal={false}
            >
              <DropdownMenu.Trigger asChild>
                <Button
                  type="button"
                  size="xs"
                  className="wireframe-mobile-view-trigger"
                  aria-label={`Current view: ${view[0].toUpperCase() + view.slice(1)}`}
                >
                  {view === "table" ? (
                    <Table2 size={16} aria-hidden="true" />
                  ) : view === "list" ? (
                    <List size={16} aria-hidden="true" />
                  ) : (
                    <GalleryHorizontal size={16} aria-hidden="true" />
                  )}
                  <span>{view[0].toUpperCase() + view.slice(1)}</span>
                  <ChevronDown size={14} aria-hidden="true" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal zIndex={20}>
                <DropdownMenu.Content
                  className="record-utilities-menu wireframe-mobile-view-menu"
                  aria-label="Choose collection view"
                  loop
                >
                  <DropdownMenu.Label>View as</DropdownMenu.Label>
                  <DropdownMenu.RadioGroup
                    value={view}
                    onValueChange={(value) => {
                      setView(value as typeof view);
                      setMobileViewMenuOpen(false);
                    }}
                  >
                    {(["table", "list", "gallery"] as const).map((mode) => (
                      <DropdownMenu.RadioItem key={mode} value={mode} textValue={`${mode} view`}>
                        <DropdownMenu.ItemIndicator />
                        <DropdownMenu.ItemTitle>{mode[0].toUpperCase() + mode.slice(1)}</DropdownMenu.ItemTitle>
                      </DropdownMenu.RadioItem>
                    ))}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu>
            <RecordUtilities
              label={tableTitle}
              search={query}
              onSearch={(value) => {
                setQuery(value);
                resetPage();
              }}
              sort={sort}
              onSort={(value) => {
                setSort(value);
                resetPage();
              }}
              direction={direction}
              onDirection={() => setDirection((value) => (value === "asc" ? "desc" : "asc"))}
              filter={filter}
              onFilter={(value) => {
                setFilter(value);
                resetPage();
              }}
              sortOptions={[
                { value: "title", label: "Name" },
                { value: "status", label: "Status" },
                { value: "meta", label: "Metadata" },
              ]}
              filterOptions={[...new Set(activeRecords.map((record) => config.cardStatus(record)))]}
              totalCount={activeRecords.length}
              visibleCount={matchingRecords.length}
              compact
            />
            <TableSettingsMenu
              viewId={view}
              onViewChange={setView}
              properties={propertyOptions}
              propertyConfiguration={propertyConfiguration}
              maxVisibleProperties={view === "list" ? 5 : undefined}
              sort={sort}
              onSort={(value) => {
                setSort(value);
                resetPage();
              }}
              onDirection={() => setDirection((value) => (value === "asc" ? "desc" : "asc"))}
              direction={direction}
              sortOptions={[
                { value: "title", label: "Name" },
                { value: "status", label: "Status" },
                { value: "meta", label: "Metadata" },
              ]}
              filter={filter}
              onFilter={(value) => {
                setFilter(value);
                resetPage();
              }}
              filterOptions={[...new Set(activeRecords.map((record) => config.cardStatus(record)))]}
              groupBy={groupBy}
              onGroupBy={(value) => {
                setGroupBy(value);
                resetPage();
              }}
              groupOptions={propertyOptions.map((property) => ({ value: property.id, label: property.label }))}
              galleryCardSize={galleryCardSize}
              onGalleryCardSizeChange={setGalleryCardSize}
              galleryFillMedia={galleryFillMedia}
              onGalleryFillMediaChange={setGalleryFillMedia}
              galleryImageSource={galleryImageSelection}
              galleryImageOptions={galleryImageOptions}
              onGalleryImageSourceChange={setGalleryImageSelection}
              tableIcon={tableIcon}
              tableIconOptions={PROPERTY_ICON_LIBRARY}
              onTableIconChange={updateTableIcon}
            />
            <Theme name="light">
              <Table.Actions
                onNew={config.onCreateRecord}
                {...config.recordActions}
                newRecordUtility={
                  config.newRecordUtility
                    ? {
                        ...config.newRecordUtility,
                        options: config.newRecordUtility.options,
                      }
                    : config.newRecordUtility
                }
                newOptionsLabel="New record options"
                newLabel="New record"
              />
            </Theme>
          </div>
          {visibleRecords.length === 0 ? (
            <div className="wireframe-empty-state" role="status">
              <strong>No {tableTitle.toLowerCase()} records found</strong>
              <p>Try a different search.</p>
            </div>
          ) : (
            <div className={groupBy ? "wireframe-record-groups" : undefined}>
              {visibleRecordGroups.map((group) => (
                <section className={groupBy ? "wireframe-record-group" : undefined} key={group.key}>
                  {groupBy ? (
                    <h3 className="wireframe-record-group-heading">
                      <span>
                        {groupPropertyLabel}: {group.label}
                      </span>
                      <span className="wireframe-record-group-count">{group.records.length}</span>
                    </h3>
                  ) : null}
                  <div
                    className={`demo-results demo-${view} ${view === "gallery" ? `gallery-size-${galleryCardSize}` : ""} ${galleryFillMedia ? "gallery-fill-media" : "gallery-fit-media"}`}
                    role="group"
                    aria-label={`${tableTitle}${groupBy ? ` ${groupPropertyLabel}: ${group.label}` : ""} records`}
                  >
                    {view === "table" ? (
                      <WireframeAgGrid
                        records={group.records}
                        visiblePropertyIds={visiblePropertyIds}
                        properties={config.properties}
                        cardImage={config.cardImage}
                        onRecordSelect={setSelectedID}
                      />
                    ) : view === "list" ? (
                      <WireframeMvpList
                        config={config}
                        records={group.records}
                        visiblePropertyIds={visiblePropertyIds}
                        onRecordSelect={setSelectedID}
                      />
                    ) : (
                      group.records.map((record, index) =>
                        (() => {
                          const subtitleVisible = isGallerySlotVisible(
                            record,
                            config.cardSubtitle(record),
                            visiblePropertyIds,
                            config.properties,
                          );
                          const statusVisible = isGallerySlotVisible(
                            record,
                            config.cardStatus(record),
                            visiblePropertyIds,
                            config.properties,
                          );
                          const metaVisible = isGallerySlotVisible(
                            record,
                            config.cardMeta(record),
                            visiblePropertyIds,
                            config.properties,
                          );
                          const repeatedValues = [
                            config.cardTitle(record),
                            ...(subtitleVisible ? [config.cardSubtitle(record)] : []),
                            ...(statusVisible ? [config.cardStatus(record)] : []),
                            ...(metaVisible ? [config.cardMeta(record)] : []),
                          ];
                          return (
                            <button
                              ref={selectedID === record.id ? selectedCardRef : undefined}
                              type="button"
                              aria-pressed={selectedID === record.id}
                              className={`demo-place-card ${selectedID === record.id ? "selected" : ""}`}
                              onClick={() => setSelectedID(record.id)}
                              key={record.id}
                            >
                              {galleryImageSelection === "__record-cover" &&
                              (config.cover?.(record) ?? storedCovers[record.id]) ? (
                                <WireframeCoverCardImage
                                  cover={(config.cover?.(record) ?? storedCovers[record.id])!}
                                  alt={`${config.cardTitle(record)} cover`}
                                />
                              ) : galleryImageSelection !== "__canvas" &&
                                galleryImageSelection !== "__record-cover" &&
                                (galleryImageSelection === "__record-image"
                                  ? config.cardImage?.(record)?.src
                                  : galleryImageSource(record, galleryImageSelection)) ? (
                                <span className="demo-place-image">
                                  <img
                                    src={
                                      galleryImageSelection === "__record-image"
                                        ? config.cardImage?.(record)?.src
                                        : galleryImageSource(record, galleryImageSelection)
                                    }
                                    alt={config.cardImage?.(record)?.alt ?? `${config.cardTitle(record)} image`}
                                  />
                                </span>
                              ) : (
                                <span
                                  className="demo-place-image"
                                  style={{
                                    background: `linear-gradient(135deg, ${cardColors[index % cardColors.length]}, #527b82)`,
                                  }}
                                  aria-hidden="true"
                                />
                              )}
                              <span className="demo-place-copy">
                                <strong>{config.cardTitle(record)}</strong>
                                {subtitleVisible ? <small>{config.cardSubtitle(record)}</small> : null}
                                {statusVisible ? (
                                  <GemStatusPill wireframe>{config.cardStatus(record)}</GemStatusPill>
                                ) : null}
                                <span className="demo-place-properties" aria-label="Visible properties">
                                  {getGalleryCardProperties(
                                    record,
                                    visiblePropertyIds,
                                    config.properties,
                                    repeatedValues,
                                  ).map((property) => (
                                    <small
                                      className="demo-place-property"
                                      aria-label={`${property.label}: ${property.value}`}
                                      key={property.id}
                                    >
                                      {property.value}
                                    </small>
                                  ))}
                                </span>
                                {metaVisible ? (
                                  <small className="demo-place-meta">
                                    {config.cardMeta(record)} · {record.id}
                                  </small>
                                ) : null}
                              </span>
                            </button>
                          );
                        })(),
                      )
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
          <nav className="wireframe-pagination" aria-label={`${tableTitle} pages`}>
            <GemButton
              className="wireframe-design-button"
              type="button"
              variant="outlined"
              tone="wireframe"
              size="xs"
              aria-label={`Previous page of ${tableTitle}`}
              disabled={pageIndex === 0 || sortedRecords.length === 0}
              onClick={() => setPageIndex((page) => Math.max(0, page - 1))}
            >
              Previous
            </GemButton>
            <span role="status">
              {sortedRecords.length === 0
                ? "0 records"
                : `${pageIndex * pageSize + 1}–${Math.min(sortedRecords.length, (pageIndex + 1) * pageSize)} of ${sortedRecords.length}`}
            </span>
            <GSelectField
              label="Records per page"
              value={String(pageSize)}
              width="xs"
              density="compact"
              containerClassName="wireframe-pagination-page-size"
              size="$2"
              wireframe
              options={[9, 18, 27].map((size) => ({ value: String(size), label: String(size) }))}
              onChange={(value) => {
                setPageSize(Number(value));
                resetPage();
              }}
            />
            <GemButton
              className="wireframe-design-button"
              type="button"
              variant="outlined"
              tone="wireframe"
              size="xs"
              aria-label={`Next page of ${tableTitle}`}
              disabled={pageIndex >= pageCount - 1 || sortedRecords.length === 0}
              onClick={() => setPageIndex((page) => Math.min(pageCount - 1, page + 1))}
            >
              Next
            </GemButton>
          </nav>
        </WireframePageView>
      )}
      {selected ? (
        inspectorExpanded ? null : (
          <>
            <button
              type="button"
              className="wireframe-inspector-backdrop"
              aria-label="Close record inspector"
              onClick={closeInspector}
            />
            <aside
              className={`wireframe-demo-inspector ${inspectorExpanded ? "is-expanded" : ""}`}
              aria-labelledby="wireframe-inspector-title"
            >
              <div className="demo-inspector-heading">
                <div aria-hidden="true" />
                <div className="demo-inspector-actions">
                  {inspectorExpanded ? (
                    <button
                      type="button"
                      aria-label="Back to collection"
                      title="Back to collection"
                      onClick={() => navigate(location.pathname.replace(/\/record\/[^/]+$/, ""))}
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="Open record page"
                      title="Open record page"
                      onClick={openRecordPage}
                    >
                      <Expand size={15} aria-hidden="true" />
                    </button>
                  )}
                  <GemButton
                    type="button"
                    className="wireframe-inspector-trash-button"
                    size="xs"
                    variant="quiet"
                    tone="secondary"
                    aria-label="Move record to Trash"
                    disabled={archiveRecord.isPending}
                    onClick={() => void moveSelectedToTrash()}
                  >
                    <Archive size={15} aria-hidden="true" />
                  </GemButton>
                  <button type="button" aria-label="Close inspector" title="Close inspector" onClick={closeInspector}>
                    ×
                  </button>
                </div>
              </div>
              {archiveError ? (
                <p className="wireframe-system-error" role="alert">
                  {archiveError}
                </p>
              ) : null}
              <WireframeCover
                recordKey={selected.id}
                value={selectedCover}
                onChange={(cover) => persistCover(selected, cover)}
                onUpload={(file) => uploadCover(selected, file)}
              />
              <div className="wireframe-inspector-record-title">
                <GemSectionHeading
                  id="wireframe-inspector-title"
                  fontSize="$4"
                  lineHeight="$4"
                  color="$wireframeHeading"
                >
                  {config.cardTitle(selected)}
                </GemSectionHeading>
              </div>
              <WireframeInspector
                node={config.inspector(selected, schemaProperties)}
                options={inspectorRenderOptions}
              />
            </aside>
          </>
        )
      ) : null}
      {propertyDetails ? (
        <WireframePropertySettingsDialog
          property={propertyDetails}
          dialogRef={propertyDetailsDialogRef}
          onChange={setPropertyDetails}
          onClose={() => setPropertyDetails(null)}
          onSave={() => {
            savePropertyIcon(propertyDetails.id, propertyDetails.icon);
            setPropertyDetails(null);
          }}
        />
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
    icon: config
      .cardTitle(record)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase())
      .join(""),
    image: config.cardImage?.(record),
  }));
  const first = records[0] as Record<string, unknown> | undefined;
  const properties: readonly RecordPropertyDefinition<T>[] = first
    ? visiblePropertyIds
        .filter((field) => field !== "id")
        .map((field) => {
          const adapted = config.properties?.find(
            (property) => property.id === field || property.sourceField === field,
          );
          if (adapted) return adapted;
          return {
            id: field,
            label: field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase()),
            kind: isImageProperty(field, first[field]) ? "image" : typeof first[field] === "number" ? "number" : "text",
            getValue: (record: T) =>
              isImageProperty(field, (record as Record<string, unknown>)[field])
                ? {
                    raw: (record as Record<string, unknown>)[field],
                    display: "",
                    image: { src: String((record as Record<string, unknown>)[field]), alt: field },
                  }
                : {
                    raw: (record as Record<string, unknown>)[field],
                    display:
                      (record as Record<string, unknown>)[field] == null
                        ? "—"
                        : String((record as Record<string, unknown>)[field]),
                  },
          };
        })
    : [];
  return (
    <RecordList
      records={tableRecords}
      properties={properties}
      onExpansionChange={(id) => id && onRecordSelect(String(id))}
    />
  );
}

function WireframeAgGrid<T extends WireframeRecord>({
  records,
  visiblePropertyIds,
  properties = [],
  cardImage,
  onRecordSelect,
}: {
  records: readonly T[];
  visiblePropertyIds: readonly string[];
  properties?: readonly RecordPropertyDefinition<T>[];
  cardImage?: (record: T) => { src: string; alt: string } | undefined;
  onRecordSelect: (id: string) => void;
}) {
  const fields = ["id", ...visiblePropertyIds.filter((field) => field !== "id")];
  const columns: ColDef<T>[] = fields.map((field) => {
    const property = properties.find((item) => item.id === field || item.sourceField === field);
    return {
      field: field as ColDefField<T>,
      headerName: property?.label ?? propertyLabel(field),
      flex: 1,
      minWidth: 140,
      valueGetter: ({ data }) => {
        if (!data) return undefined;
        if (field === "image") return cardImage?.(data)?.src;
        if (!property) return (data as Record<string, unknown>)[field];
        const value = property.getValue(data);
        return (
          value.raw ??
          (typeof value.display === "string" || typeof value.display === "number" ? value.display : undefined)
        );
      },
      valueFormatter: (params) => {
        if (!property || !params.data) return formatWireframeTableValue(field, params.value);
        const display = property.getValue(params.data).display;
        return typeof display === "string" || typeof display === "number"
          ? String(display)
          : display == null
            ? "—"
            : "";
      },
      cellRenderer: (params: ICellRendererParams<T>) => {
        if (!params.data) return "";
        const rawValue =
          field === "image"
            ? cardImage?.(params.data)?.src
            : property
              ? property.getValue(params.data).raw
              : (params.data as Record<string, unknown>)[field];
        if (isImageProperty(field, rawValue)) {
          return (
            <img
              className="wireframe-table-image"
              src={String(rawValue)}
              alt={field === "image" ? (cardImage?.(params.data)?.alt ?? "Record image") : `${field} preview`}
            />
          );
        }
        if (property) {
          const display = property.getValue(params.data).display;
          const value = property.getValue(params.data);
          if ((property.kind === "url" || property.kind === "email") && value.href) {
            return (
              <a
                className="primitive-value-link"
                href={value.href}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                {typeof display === "string" ? display : value.href}
              </a>
            );
          }
          return typeof display === "string" || typeof display === "number"
            ? String(display)
            : display == null
              ? "—"
              : "";
        }
        return formatWireframeTableValue(field, rawValue);
      },
    };
  });
  return (
    <div className="wireframe-ag-grid">
      <AgGridReact<T>
        theme={themeQuartz}
        rowData={[...records]}
        columnDefs={columns}
        getRowId={({ data }) => data.id}
        onRowClicked={({ data }) => data && onRecordSelect(data.id)}
        domLayout="autoHeight"
      />
    </div>
  );
}

function isImageProperty(field: string, value: unknown): boolean {
  return (
    typeof value === "string" &&
    /(^|_|-)(image|logo|avatar|cover|photo|thumbnail)(s|$)/i.test(field.replace(/([a-z])([A-Z])/g, "$1_$2"))
  );
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
          const formatted =
            address && typeof address === "object"
              ? formatAddress(address as Parameters<typeof formatAddress>[0])
              : "Address unavailable";
          return { raw, display: formatted };
        }
        return { raw, display: raw == null || raw === "" ? "—" : String(raw) };
      },
    };
  });
}

function getWireframeGroup(
  rawValue: unknown,
  statusLabel?: string,
  display?: ReactNode,
): { key: string; label: string } {
  if (rawValue === null || rawValue === "") return { key: "empty", label: "Empty" };
  if (typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean") {
    const label = String(rawValue).trim();
    return label ? { key: `${typeof rawValue}:${label}`, label } : { key: "empty", label: "Empty" };
  }
  if (statusLabel) return { key: `status:${statusLabel}`, label: statusLabel };
  if (typeof display === "string" || typeof display === "number") {
    const label = String(display).trim();
    return label && label !== "—" ? { key: `display:${label}`, label } : { key: "empty", label: "Empty" };
  }
  return rawValue === undefined ? { key: "empty", label: "Empty" } : { key: "other", label: "Other" };
}

function schemaColumnSourceField<T extends WireframeRecord>(
  column: { name: string; primaryKey: boolean },
  records: readonly T[],
): string {
  if (column.primaryKey) return "id";
  if (column.name.toLowerCase() === "dateupdated") return "updatedAt";
  const recordKeys = records.flatMap((record) => Object.keys(record));
  const matchingKey = recordKeys.find((key) => key.toLowerCase() === column.name.toLowerCase());
  return (
    matchingKey ??
    column.name
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .split(" ")
      .map((part, index) => (index === 0 ? part.toLowerCase() : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`))
      .join("")
  );
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
  const seen = new Set(
    repeatedValues.flatMap((value) => value.split(/[·•|]/).map(normalizeGalleryValue)).filter(Boolean),
  );
  return visiblePropertyIds
    .filter(
      (id) =>
        id !== "id" &&
        (Object.hasOwn(values, id) ||
          properties.some((property) => property.id === id || property.sourceField === id)) &&
        !isImageProperty(id, values[id]),
    )
    .map((id) => {
      const property = properties.find((item) => item.id === id || item.sourceField === id);
      const adapted = property?.getValue(record);
      const rawDisplay = adapted?.display;
      const value =
        typeof rawDisplay === "string" || typeof rawDisplay === "number"
          ? String(rawDisplay)
          : typeof values[id] === "boolean"
            ? values[id]
              ? "Yes"
              : "No"
            : values[id] && typeof values[id] === "object"
              ? "—"
              : formatWireframeTableValue(id, values[id]);
      return {
        id,
        label:
          property?.label ??
          id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase()),
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

function isGallerySlotVisible<T extends WireframeRecord>(
  record: T,
  slotValue: string,
  visiblePropertyIds: readonly string[],
  properties: readonly RecordPropertyDefinition<T>[] = [],
): boolean {
  const normalizedSlotValue = normalizeGalleryValue(slotValue);
  return properties.some((property) => {
    if (!visiblePropertyIds.includes(property.id) && !visiblePropertyIds.includes(property.sourceField ?? ""))
      return false;
    const value = property.getValue(record).display;
    return (
      (typeof value === "string" || typeof value === "number") &&
      normalizeGalleryValue(String(value)) === normalizedSlotValue
    );
  });
}

function normalizeGalleryValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function formatWireframeTableValue(field: string, value: unknown): string {
  if (typeof value !== "number") return value == null || value === "" ? "—" : String(value);
  return formatRecordNumber(value, inferRecordNumberFormat(field));
}
type InspectorRenderOptions = {
  onDetails: (
    details: { id: string; label: string; value: string; type?: string; icon?: string },
    trigger: HTMLButtonElement,
  ) => void;
  propertyDetailsID: string | null;
  propertyIcons: Readonly<Record<string, string>>;
  propertyOrder?: readonly string[];
  onReorder: (order: string[], announcement: string) => void;
  draggedPropertyRef: React.MutableRefObject<string | null>;
  draggedPropertyID: string | null;
  dropTargetID: string | null;
  setDraggedPropertyID: (id: string | null) => void;
  setDropTargetID: (id: string | null) => void;
  announcement: string;
};

function WireframeInspector({ node, options }: { node: ReactNode; options: InspectorRenderOptions }) {
  if (!isValidElement(node) || node.type !== "dl") return node;
  const rows = React.Children.toArray((node.props as { children?: ReactNode }).children).map((row, originalIndex) => {
    if (!isValidElement(row))
      return { row, originalIndex, propertyID: null, labelText: "", valueText: "", metadata: null };
    const children = React.Children.toArray((row.props as { children?: ReactNode }).children);
    const label = children.find((child) => isValidElement(child) && child.type === "dt");
    const value = children.find((child) => isValidElement(child) && child.type === "dd");
    if (!isValidElement(label) || !isValidElement(value))
      return { row, originalIndex, propertyID: null, labelText: "", valueText: "", metadata: null };
    const labelText = String((label.props as { children?: ReactNode }).children ?? "");
    const propertyID = String((label.props as { "data-property-id"?: string })["data-property-id"] ?? labelText);
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
      iconName: options.propertyIcons[propertyID] ?? data["data-property-icon"],
    });
    return {
      row,
      originalIndex,
      propertyID,
      labelText,
      valueText: String((value.props as { children?: ReactNode }).children ?? ""),
      metadata,
    };
  });
  const propertyIDs = rows.flatMap((entry) => (entry.propertyID ? [entry.propertyID] : []));
  const savedOrder = [...new Set(options.propertyOrder ?? [])].filter((id) => propertyIDs.includes(id));
  const order = [...savedOrder, ...propertyIDs.filter((id) => !savedOrder.includes(id))];
  rows.sort((left, right) => {
    const leftOrder = left.propertyID ? order.indexOf(left.propertyID) : Number.MAX_SAFE_INTEGER;
    const rightOrder = right.propertyID ? order.indexOf(right.propertyID) : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.originalIndex - right.originalIndex;
  });
  const reorder = (sourceID: string, targetID: string, labelText: string) => {
    const sourceIndex = order.indexOf(sourceID);
    const targetIndex = order.indexOf(targetID);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const nextOrder = [...order];
    nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, sourceID);
    options.onReorder(nextOrder, `${labelText} moved to position ${targetIndex + 1} of ${nextOrder.length}.`);
  };
  return (
    <>
      {cloneElement(
        node as React.ReactElement<{ children?: ReactNode }>,
        {},
        rows.map(({ row, propertyID, labelText, valueText, metadata }) => {
          if (!propertyID || !metadata || !isValidElement(row)) return row;
          const children = React.Children.toArray((row.props as { children?: ReactNode }).children);
          const value = children.find((child) => isValidElement(child) && child.type === "dd");
          return cloneElement(
            row as React.ReactElement<Record<string, unknown>>,
            {
              "data-inspector-property-row": propertyID,
              className: [
                (row.props as { className?: string }).className,
                options.dropTargetID === propertyID ? "is-drop-target" : "",
                options.draggedPropertyID === propertyID ? "is-being-dragged" : "",
              ]
                .filter(Boolean)
                .join(" "),
              onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
                if (!options.draggedPropertyRef.current) return;
                const target = document
                  .elementFromPoint(event.clientX, event.clientY)
                  ?.closest<HTMLElement>("[data-inspector-property-row]");
                options.setDropTargetID(target?.dataset.inspectorPropertyRow ?? null);
              },
              onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
                const sourceID = options.draggedPropertyRef.current;
                if (!sourceID) return;
                const target = document
                  .elementFromPoint(event.clientX, event.clientY)
                  ?.closest<HTMLElement>("[data-inspector-property-row]");
                const targetID = target?.dataset.inspectorPropertyRow;
                if (targetID)
                  reorder(
                    sourceID,
                    targetID,
                    rows.find((entry) => entry.propertyID === sourceID)?.labelText ?? labelText,
                  );
                options.draggedPropertyRef.current = null;
                options.setDraggedPropertyID(null);
                options.setDropTargetID(null);
              },
              onPointerCancel: () => {
                options.draggedPropertyRef.current = null;
                options.setDraggedPropertyID(null);
                options.setDropTargetID(null);
              },
            },
            <>
              <dt data-property-id={propertyID}>
                <button
                  type="button"
                  className="wireframe-property-sort-handle"
                  aria-label={`Reorder ${labelText}`}
                  title="Drag to reorder, or use the Up and Down arrow keys"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    options.draggedPropertyRef.current = propertyID;
                    options.setDraggedPropertyID(propertyID);
                    options.setDropTargetID(propertyID);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                    const index = order.indexOf(propertyID);
                    const targetIndex = index + (event.key === "ArrowUp" ? -1 : 1);
                    if (targetIndex < 0 || targetIndex >= order.length) return;
                    event.preventDefault();
                    const nextOrder = [...order];
                    nextOrder.splice(index, 1);
                    nextOrder.splice(targetIndex, 0, propertyID);
                    options.onReorder(
                      nextOrder,
                      `${labelText} moved to position ${targetIndex + 1} of ${nextOrder.length}.`,
                    );
                  }}
                >
                  <GripVertical size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="wireframe-property-details-trigger"
                  aria-label={`Open details for ${labelText}`}
                  aria-haspopup="dialog"
                  aria-expanded={options.propertyDetailsID === propertyID}
                  onClick={(event) =>
                    options.onDetails(
                      {
                        label: labelText,
                        value: valueText,
                        type: metadata.type,
                        id: propertyID,
                        icon: metadata.iconName,
                      },
                      event.currentTarget,
                    )
                  }
                >
                  <PropertyIcon name={metadata.iconName} size={13} />
                </button>
                {labelText}
              </dt>
              {value}
            </>,
          );
        }),
      )}
      <span className="sr-only" role="status">
        {options.announcement}
      </span>
    </>
  );
}
