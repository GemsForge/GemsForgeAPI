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
  onImportFile?: () => void | Promise<void>;
  onPasteCsv?: () => void | Promise<void>;
  onPasteJson?: () => void | Promise<void>;
  newLabel?: string;
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
