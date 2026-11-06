import { formatRecordNumber, inferRecordNumberFormat, type RecordPropertyDefinition } from "../../table-kit";
import { WireframeRecordInspector, type WireframeInspectorField } from "./WireframeRecordInspector";
import { inferWireframePropertyMetadata } from "./propertyMetadata";

function editorKind(
  kind: RecordPropertyDefinition<unknown>["kind"],
  inputType?: string,
): WireframeInspectorField["kind"] {
  if (inputType === "longText") return "textarea";
  if (kind === "select" || kind === "status") return kind;
  if (kind === "relation") return "relation";
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
      const metadata = inferWireframePropertyMetadata({
        label: property.label,
        kind: metadataKind,
        numberFormat: property.numberFormat,
        propertyType: property.propertyType,
        iconName: property.iconName,
      });
      const resolvedKind: WireframeInspectorField["kind"] =
        metadata.type === "URL" ? "url" : metadata.type === "Email" ? "email" : kind;
      const displayValue = property.getValue(record).display;
      const propertyValue = property.getValue(record);
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
          property.kind === "number" && typeof value.raw === "number"
            ? formatRecordNumber(
                value.raw,
                property.numberFormat ?? inferRecordNumberFormat(property.id, property.label),
              )
            : (property.kind === "url" || property.kind === "email" || property.kind === "relation") &&
                propertyValue.href
              ? typeof displayValue === "string"
                ? linkedDisplayValue
                : propertyValue.href
              : value.display,
        display: linkedDisplayValue,
        kind: resolvedKind,
        propertyKind: property.kind,
        propertyType: metadata.type,
        iconName: metadata.iconName,
        numberFormat: property.numberFormat,
        nullable: edit?.nullable,
        options: edit?.options?.map((option) => ({ value: option.value, label: option.label })),
        onCommit: edit ? async (next: string) => edit.onSave(record, next) : undefined,
        renderEditor: edit?.renderEditor,
      } satisfies WireframeInspectorField;
    });

  const recordID = "id" in record ? String((record as { id: unknown }).id) : "";
  return <WireframeRecordInspector key={recordID} fields={fields} />;
}
