import type { ReactNode } from "react";

export interface TableColumn<Row> {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  visible?: boolean;
}

export interface TableView {
  id: string;
  label: string;
}

export interface TablePagination {
  pageIndex: number;
  pageSize: number;
  total: number;
}

export interface TablePaginationState {
  pageIndex: number;
  pageSize: number;
}

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
