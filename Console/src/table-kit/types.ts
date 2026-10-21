import type { ReactNode } from "react";

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
}
