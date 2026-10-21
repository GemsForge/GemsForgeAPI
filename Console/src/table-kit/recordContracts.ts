import type { ReactNode } from "react";

/** Stable identity used by Table Kit selection, expansion, and row keys. */
export type TableRecordId = string;

/** Supported semantic hints for a record property renderer. */
export type RecordPropertyKind =
  "title" | "text" | "number" | "date" | "select" | "status" | "image" | "relation" | "formula" | "unknown";

/** Image metadata that an adapter can provide without coupling the renderer to a domain. */
export interface RecordImage {
  src: string;
  alt: string;
  fit?: "cover" | "contain";
}

/** Accessible status metadata shared by list, gallery, and table renderers. */
export interface RecordStatus {
  label: string;
  tone?: "default" | "success" | "warning" | "danger";
}

/** The display payload for one property while preserving its source value for adapters. */
export interface RecordPropertyValue {
  raw?: unknown;
  display: ReactNode;
  image?: RecordImage;
  status?: RecordStatus;
}

/** Domain-neutral property metadata consumed by every Table Kit view. */
export interface RecordPropertyDefinition<Record> {
  id: string;
  label: string;
  kind?: RecordPropertyKind;
  order?: number;
  visible?: boolean;
  primary?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  getValue: (record: Record) => RecordPropertyValue;
}

/** A normalized record identity and optional presentation metadata for a view adapter. */
export interface TableRecord<Record> {
  id: TableRecordId;
  source: Record;
  title?: string;
  subtitle?: string;
  image?: RecordImage;
  status?: RecordStatus;
}

/** Adapter boundary for turning a domain record into shared Table Kit metadata. */
export interface RecordAdapter<Record> {
  getId: (record: Record, index: number) => TableRecordId;
  getTitle?: (record: Record) => string | undefined;
  getSubtitle?: (record: Record) => string | undefined;
  getImage?: (record: Record) => RecordImage | undefined;
  getStatus?: (record: Record) => RecordStatus | undefined;
  getProperties: (record: Record) => readonly RecordPropertyDefinition<Record>[];
}

/** Controlled selection state shared by table, list, and gallery interactions. */
export interface RecordSelectionState {
  selectedIds: ReadonlySet<TableRecordId>;
  anchorId?: TableRecordId;
}

/** Selection callbacks are intentionally controlled so feature state remains outside renderers. */
export interface RecordSelectionHandlers {
  onSelectionChange: (state: RecordSelectionState) => void;
  onRecordSelect?: (id: TableRecordId) => void;
}

/** Controlled expansion state for a single record detail surface. */
export interface RecordExpansionState {
  expandedId?: TableRecordId;
}

/** Expansion callbacks are an integration boundary; renderers do not own domain detail state. */
export interface RecordExpansionHandlers<Record> {
  onExpansionChange: (expandedId: TableRecordId | undefined) => void;
  renderExpanded?: (record: Record) => ReactNode;
}

/** Resolve stable property order without mutating the adapter-owned array. */
export function orderRecordProperties<Record>(
  properties: readonly RecordPropertyDefinition<Record>[],
): readonly RecordPropertyDefinition<Record>[] {
  return properties
    .map((property, index) => ({ property, index }))
    .sort((left, right) => (left.property.order ?? left.index) - (right.property.order ?? right.index))
    .map(({ property }) => property);
}

/** Return the explicitly primary property, or the first property in stable display order. */
export function getPrimaryRecordProperty<Record>(
  properties: readonly RecordPropertyDefinition<Record>[],
): RecordPropertyDefinition<Record> | undefined {
  return orderRecordProperties(properties).find((property) => property.primary) ?? orderRecordProperties(properties)[0];
}
