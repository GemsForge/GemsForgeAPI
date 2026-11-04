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
] as const;

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
