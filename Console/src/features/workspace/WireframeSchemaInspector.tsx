import { formatRecordNumber, inferRecordNumberFormat, type RecordPropertyDefinition } from "../../table-kit";
import { WireframeRecordInspector, type WireframeInspectorField } from "./WireframeRecordInspector";
import { inferWireframePropertyMetadata } from "./propertyMetadata";
import { useContext } from "react";
import { WireframePropertySelectOptionsContext, WireframePropertyTypeContext } from "./WireframePropertyEditor";
import { decodeMultiSelectValue } from "@gemsforge/ui";

function editorKind(
  kind: RecordPropertyDefinition<unknown>["kind"],
  inputType?: string,
): WireframeInspectorField["kind"] {
  if (inputType === "longText") return "textarea";
  if (kind === "select" || kind === "status") return kind;
  if (kind === "relation") return "relation";
  if (kind === "lookup") return "lookup";
  if (kind === "date" || inputType === "date") return "date";
  if (kind === "number" || inputType === "number") return "number";
  if (kind === "url") return "url";
  if (kind === "email") return "email";
  if (inputType === "select") return "select";
  return "text";
}

export function WireframeSchemaInspector<Record extends object>({
  record,
  properties,
}: {
  record: Record;
  properties: readonly RecordPropertyDefinition<Record>[];
}) {
  const propertyTypes = useContext(WireframePropertyTypeContext);
  const propertySelectOptions = useContext(WireframePropertySelectOptionsContext);
  const seen = new Set<string>();
  const seenSourceFields = new Set<string>();
  const fields = properties
    .filter((property) => {
      const sourceField = property.sourceField ?? property.id;
      if (seen.has(property.id) || seenSourceFields.has(sourceField)) return false;
      seen.add(property.id);
      seenSourceFields.add(sourceField);
      return true;
    })
    .sort((left, right) => (left.id === "id" ? -1 : right.id === "id" ? 1 : 0))
    .map((property) => {
      const value = property.getValue(record);
      const edit = property.edit;
      const kind = editorKind(property.kind, edit?.inputType);
      const metadataKind =
        property.kind && property.kind !== "text"
          ? property.kind
          : edit?.inputType === "select"
            ? "select"
            : edit?.inputType === "date"
              ? "date"
              : edit?.inputType === "number"
                ? "number"
                : (property.kind ?? kind);
      const savedPropertyType = propertyTypes[property.id] ?? property.propertyType;
      const propertyType =
        (savedPropertyType === "Relation" || savedPropertyType === "Lookup") &&
        property.kind !== savedPropertyType.toLowerCase()
          ? undefined
          : savedPropertyType;
      const metadata = inferWireframePropertyMetadata({
        label: property.label,
        kind: metadataKind,
        numberFormat: property.numberFormat,
        propertyType,
        iconName: property.iconName,
      });
      const typeKind: Partial<{ [typeName: string]: WireframeInspectorField["kind"] }> = {
        Text: "text",
        Name: "text",
        Notes: "textarea",
        Select: "select",
        "Multi-select": "multiselect",
        Tags: "multiselect",
        Status: "status",
        Number: "number",
        Currency: "number",
        Percent: "number",
        Date: "date",
        URL: "url",
        Relation: property.kind === "relation" ? "relation" : undefined,
        Lookup: property.kind === "lookup" ? "lookup" : undefined,
      };
      const resolvedKind: WireframeInspectorField["kind"] = typeKind[metadata.type] ?? kind;
      const options =
        propertySelectOptions[property.id]?.map((option) => ({ value: option, label: option })) ??
        edit?.options?.map((option) => ({ value: option.value, label: option.label })) ??
        [];
      const displayValue = property.getValue(record).display;
      const propertyValue = property.getValue(record);
      const multiSelectDisplay =
        resolvedKind === "multiselect"
          ? decodeMultiSelectValue(String(value.raw ?? ""))
              .map((selected) => options.find((option) => option.value === selected)?.label ?? selected)
              .join(", ")
          : undefined;
      const linkedDisplayValue =
        (property.kind === "url" || property.kind === "email" || property.kind === "relation") && propertyValue.href ? (
          <a
            className="primitive-value-link"
            href={propertyValue.href}
            target={property.kind === "url" ? "_blank" : undefined}
            rel={property.kind === "url" ? "noreferrer" : undefined}
            onClick={(event) => event.stopPropagation()}
          >
            {typeof displayValue === "string" ? displayValue : propertyValue.href}
          </a>
        ) : (
          displayValue
        );
      return {
        id: property.id,
        label: property.label,
        value:
          typeof value.raw === "string" || typeof value.raw === "number" || typeof value.raw === "boolean"
            ? String(value.raw)
            : "",
        displayValue:
          property.kind === "relation"
            ? value.display
            : property.kind === "number" && typeof value.raw === "number"
              ? formatRecordNumber(
                  value.raw,
                  property.numberFormat ?? inferRecordNumberFormat(property.id, property.label),
                )
              : (property.kind === "url" || property.kind === "email") && propertyValue.href
                ? typeof displayValue === "string"
                  ? linkedDisplayValue
                  : propertyValue.href
                : (multiSelectDisplay ?? value.display),
        display: linkedDisplayValue,
        relatedHref: property.kind === "relation" ? propertyValue.href : undefined,
        kind: resolvedKind,
        propertyKind: property.kind,
        propertyType: metadata.type,
        iconName: metadata.iconName,
        numberFormat: property.numberFormat,
        onCommit: edit ? async (next: string) => edit.onSave(record, next) : undefined,
        options,
        nullable: edit?.nullable,
        renderEditor: edit?.renderEditor,
      } satisfies WireframeInspectorField;
    });

  const recordID = "id" in record ? String((record as { id: unknown }).id) : "";
  return <WireframeRecordInspector key={recordID} fields={fields} />;
}
