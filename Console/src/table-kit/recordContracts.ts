import type { ReactNode } from "react";

/** Stable identity used by Table Kit selection, expansion, and row keys. */
export type TableRecordId = string;

/** Supported semantic hints for a record property renderer. */
export type RecordPropertyKind =
  | "title"
  | "text"
  | "url"
  | "email"
  | "number"
  | "date"
  | "select"
  | "status"
  | "checkbox"
  | "image"
  | "media"
  | "relation"
  | "formula";

/** Database storage categories remain separate from the UI editing primitive. */
export type RecordStorageType = "text" | "integer" | "real" | "boolean" | "blob" | "date" | "unknown";

export type RecordNumberFormat = "decimal" | "currency" | "percent";
export type RecordDateFormat = "iso" | "local" | "relative";
export type RecordColorToken = "mint" | "gold" | "blue" | "green" | "purple" | "orange" | "red" | "gray";

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
  href?: string;
  checked?: boolean;
  colorToken?: RecordColorToken;
}

/** Domain-neutral property metadata consumed by every Table Kit view. */
export interface RecordPropertyDefinition<Record> {
  id: string;
  label: string;
  /** Physical database type, when known. A date may still be stored as text. */
  storageType?: RecordStorageType;
  kind?: RecordPropertyKind;
  numberFormat?: RecordNumberFormat;
  dateFormat?: RecordDateFormat;
  /** Explicit inspector type override when the inferred type is not suitable. */
  propertyType?: string;
  /** Explicit icon catalog name for this property. */
  iconName?: string;
  colorToken?: RecordColorToken;
  order?: number;
  visible?: boolean;
  primary?: boolean;
  /** Backing record field when this property uses a presentation alias. */
  sourceField?: string;
  sortable?: boolean;
  filterable?: boolean;
  getValue: (record: Record) => RecordPropertyValue;
  /** Optional inline editor used by views that support live property editing. */
  edit?: RecordPropertyEdit;
}

export interface RecordPropertyEdit {
  inputType?: "text" | "date" | "number" | "select" | "longText";
  nullable?: boolean;
  options?: RecordSelectOption[];
  onSave: (record: unknown, value: string | number | null) => Promise<void>;
}

/** A selectable value with optional visual metadata for status/select primitives. */
export interface RecordSelectOption {
  label: string;
  value: string;
  colorToken?: RecordColorToken;
  isDefault?: boolean;
  group?: string;
}

/** A normalized record identity and optional presentation metadata for a view adapter. */
export interface TableRecord<Record> {
  id: TableRecordId;
  source: Record;
  title?: string;
  subtitle?: string;
  /** Main-page icon used when a record has no attached image. */
  icon?: ReactNode;
  image?: RecordImage;
  status?: RecordStatus;
  /** Optional editor for the primary title slot in editable views. */
  titleEdit?: RecordPropertyEdit;
}

/** Adapter boundary for turning a domain record into shared Table Kit metadata. */
export interface RecordAdapter<Record> {
  /** Normalize one domain record for all Table Kit renderers. */
  toTableRecord: (record: Record, index: number) => TableRecord<Record>;
  /** Return one stable property schema for the complete record collection. */
  getPropertyDefinitions: () => readonly RecordPropertyDefinition<Record>[];
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
  const seen = new Set<string>();
  return properties
    .map((property, index) => ({ property, index }))
    .sort((left, right) => {
      if (left.property.id === "id" || left.property.primary) {
        if (right.property.id !== "id" && !right.property.primary) return -1;
      }
      if (right.property.id === "id" || right.property.primary) {
        if (left.property.id !== "id" && !left.property.primary) return 1;
      }
      if (left.property.id === "id" && right.property.id !== "id") return -1;
      if (right.property.id === "id" && left.property.id !== "id") return 1;
      return (left.property.order ?? left.index) - (right.property.order ?? right.index);
    })
    .map(({ property }) => property)
    .filter((property) => {
      if (seen.has(property.id)) return false;
      seen.add(property.id);
      return true;
    });
}

/** Return the explicitly primary property, or the first property in stable display order. */
export function getPrimaryRecordProperty<Record>(
  properties: readonly RecordPropertyDefinition<Record>[],
): RecordPropertyDefinition<Record> | undefined {
  return orderRecordProperties(properties).find((property) => property.primary) ?? orderRecordProperties(properties)[0];
}
