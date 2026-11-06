import type { RecordNumberFormat, RecordPropertyKind } from "../../table-kit/recordContracts";
import { getPropertyIconByName, getPropertyIconDefinition, inferWireframePropertyType } from "./propertyIcons";

export type WireframePropertyMetadataInput = {
  label: string;
  kind?: RecordPropertyKind | string;
  numberFormat?: RecordNumberFormat;
  propertyType?: string;
  iconName?: string;
};

export type WireframePropertyMetadata = {
  type: string;
  iconName: string;
};

export const WIREFRAME_PROPERTY_TYPES = [
  "Name",
  "ID",
  "Text",
  "Select",
  "Multi-select",
  "Tags",
  "Status",
  "Number",
  "Currency",
  "Percent",
  "Date",
  "URL",
  "Notes",
  "Image",
  "Media",
  "Relation",
  "Lookup",
] as const;

/** Relation editors require a saved relation definition; multi-select stores TEXT. */
export function isWireframePropertyTypeAvailable(type: string, kind?: string, currentType?: string): boolean {
  if (type === currentType) return true;
  if (type === "Relation" || type === "Lookup") return kind === type.toLowerCase();
  if (type === "Multi-select" || type === "Tags") {
    return !["number", "date", "url", "email", "relation", "lookup", "checkbox", "image", "media"].includes(kind ?? "");
  }
  if (kind === "number") return ["Number", "Currency", "Percent", "Select"].includes(type);
  if (["date", "url", "email", "checkbox", "image", "media", "relation", "lookup"].includes(kind ?? "")) {
    return type === inferWireframePropertyType("", kind);
  }
  return true;
}

/** Resolve inspector type and icon once for every schema-driven wireframe. */
export function inferWireframePropertyMetadata({
  label,
  kind,
  numberFormat,
  propertyType,
  iconName,
}: WireframePropertyMetadataInput): WireframePropertyMetadata {
  const type = propertyType?.trim() || inferWireframePropertyType(label, kind, numberFormat);
  const icon = iconName?.trim()
    ? getPropertyIconByName(iconName)
    : /^(id|item id|record id|primary key)$/i.test(label.trim())
      ? getPropertyIconByName("Lock")
      : getPropertyIconDefinition(label, kind, propertyType?.trim() || (type === "Text" ? undefined : type));
  return { type, iconName: icon.name };
}
