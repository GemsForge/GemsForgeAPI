import type { ReactNode } from "react";
import type { TableQueryState } from "./query";
import type { TableSelectionContext } from "./selection";

/** A typed column definition supplied by a consuming table. */
export interface TableColumn<Row> {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  visible?: boolean;
}

/** A named presentation that can be selected by the table shell. */
export interface TableView {
  id: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  /** Optional initial query configuration restored for this named view. */
  configuration?: Partial<TableQueryState>;
}

/** The view identifiers supported by the compact Table Kit header. */
export type TableViewId = "list" | "gallery" | "table";

/** Controlled selection of exactly one compact-header presentation. */
export interface TableViewSelection {
  /** The accessible name for the view-selection control. */
  label: string;
  /** The currently selected Table Kit presentation. */
  viewId: TableViewId;
  /** Select the next presentation without owning rendering or persistence. */
  onViewChange: (viewId: TableViewId) => void;
}

/** Utility menus that can be opened from the compact Table Kit header. */
export type TableUtilityMenuId = "search" | "sort" | "filter" | "properties";

/** Controlled open-menu state for the compact utility controls. */
export interface TableUtilityMenuState {
  /** The accessible label for each utility menu. */
  labels: Readonly<Record<TableUtilityMenuId, string>>;
  /** The open menu, or `null` when all utility menus are closed. */
  openMenu: TableUtilityMenuId | null;
  /** Open one utility menu and close any other menu. */
  onOpenMenu: (menu: TableUtilityMenuId) => void;
  /** Close the currently open utility menu. */
  onCloseMenu: () => void;
}

export interface TableHeaderProps {
  title?: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  collapsibleDescription?: boolean;
}

/** Server-facing pagination metadata returned with a result page. */
export interface TablePagination {
  pageIndex: number;
  pageSize: number;
  total: number;
}

/** Client-owned pagination input used by controlled and uncontrolled roots. */
export interface TablePaginationState {
  pageIndex: number;
  pageSize: number;
}

/** Selection integration supplied by a consuming table instance. */
export interface TableRootSelectionProps<Row> {
  /** IDs for the complete effective result set, excluding non-selectable records. */
  matchingIds?: readonly string[];
  /** Return false for disabled or otherwise non-selectable records on the current page. */
  isSelectable?: (row: Row, index: number) => boolean;
  /** Return false for IDs that cannot participate in bulk actions, including off-page records. */
  isSelectableId?: (id: string) => boolean;
  /** Controlled selected IDs. Omit to let the Table.Root own selection state. */
  selectedIds?: ReadonlySet<string>;
  /** Initial selected IDs for an uncontrolled Table.Root. */
  defaultSelectedIds?: readonly string[];
  /** Called with a new immutable selection set after a user action. */
  onSelectionChange?: (selectedIds: ReadonlySet<string>) => void;
}

/** Props for the shared Select All control rendered inside a Table.Root. */
export interface TableSelectionProps {
  label?: string;
  clearLabel?: string;
  allMatchingLabel?: string;
  /** Show the cross-page matching action when a search scope is active. */
  showAllMatching?: boolean;
}

/** A consumer-owned alternate create action exposed by the New Record menu. */
export interface TableNewRecordOption {
  id: string;
  label: string;
  /** Optional accessible name when the visible label needs more context. */
  ariaLabel?: string;
  description?: ReactNode;
  onSelect: () => void | Promise<void>;
}

/** Operation families exposed by a compact New Record menu. */
export type TableNewRecordOperationType = "create" | "import" | "paste";

/** A labeled, consumer-owned create, import, or paste operation. */
export interface TableNewRecordOperationOption extends TableNewRecordOption {
  /** Identifies the operation family for grouping or analytics. */
  operation: TableNewRecordOperationType;
}

/** Accessible label and options for a consumer-owned New Record menu. */
export interface TableNewRecordOperations {
  /** Accessible name announced for the operation menu. */
  label: string;
  /** Ordered operations rendered by the consumer-owned menu. */
  options: readonly TableNewRecordOperationOption[];
}

/** Controls one consumer-owned operation rendered inside the New Record utility. */
export interface TableNewRecordUtilityOption {
  id: string;
  label: string;
  description?: ReactNode;
  /** Render the selected workflow and use close to finish or cancel it. */
  render: (controls: { close: () => void }) => ReactNode;
}

/** Configures the short-lived modal opened by the compact plus action. */
export interface TableNewRecordUtilityProps {
  title?: string;
  description?: ReactNode;
  options: readonly TableNewRecordUtilityOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** The complete, domain-neutral configuration for a Table.Root instance. */
export interface TableRootProps<Row> {
  rows: readonly Row[];
  columns: readonly TableColumn<Row>[];
  rowKey: (row: Row, index: number) => string;
  children: ReactNode;
  caption?: string;
  views?: readonly TableView[];
  defaultViewId?: string;
  viewId?: string;
  onViewChange?: (viewId: string) => void;
  pagination?: TablePagination;
  defaultPagination?: TablePaginationState;
  onPaginationChange?: (pagination: TablePaginationState) => void;
  selection?: TableRootSelectionProps<Row>;
}

export interface TableQueryFilterOption {
  value: string;
  label: string;
}
export interface TableQueryFilter {
  id: string;
  label: string;
  options: readonly TableQueryFilterOption[];
}
export interface TableQueryControlsProps {
  state: TableQueryState;
  onStateChange: (state: TableQueryState) => void;
  filters?: readonly TableQueryFilter[];
  searchLabel?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  pending?: boolean;
}
export interface TableActionsProps {
  onNew?: () => void | Promise<void>;
  onImport?: () => void | Promise<void>;
  /** Optional typed create actions shown beside file and paste intake actions. */
  newRecordOptions?: readonly TableNewRecordOption[];
  onImportFile?: () => void | Promise<void>;
  onPasteCsv?: () => void | Promise<void>;
  onPasteJson?: () => void | Promise<void>;
  newLabel?: string;
  newOptionsLabel?: string;
  /** Optional consumer-owned modal workflow for create, import, and paste operations. */
  newRecordUtility?: TableNewRecordUtilityProps;
  importLabel?: string;
  disabled?: boolean;
  pending?: boolean;
}

/** State and integration callbacks exposed to compound Table children. */
export interface TableContextValue<Row> {
  rows: readonly Row[];
  columns: readonly TableColumn<Row>[];
  rowKey: (row: Row, index: number) => string;
  caption: string;
  views: readonly TableView[];
  viewId: string | undefined;
  setViewId: (viewId: string) => void;
  pagination: TablePagination | undefined;
  setPagination: (pagination: TablePaginationState) => void;
  selection: TableSelectionContext;
}
