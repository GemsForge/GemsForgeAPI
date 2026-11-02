import { formatRecordNumber, inferRecordNumberFormat, type RecordPropertyDefinition } from "../../table-kit";
import { WireframeRecordInspector, type WireframeInspectorField } from "./WireframeRecordInspector";

function editorKind(
  kind: RecordPropertyDefinition<unknown>["kind"],
  inputType?: string,
): WireframeInspectorField["kind"] {
  if (inputType === "longText") return "textarea";
  if (kind === "date") return "date";
  if (kind === "select" || kind === "status") return kind;
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
      return {
        id: property.id,
        label: property.label,
        value: typeof value.raw === "string" ? value.raw : typeof value.raw === "number" ? String(value.raw) : "",
        displayValue:
          typeof value.raw === "number"
            ? formatRecordNumber(value.raw, property.numberFormat ?? inferRecordNumberFormat(property.id, property.label))
            : value.display,
        display: value.display,
        kind: editorKind(property.kind, edit?.inputType),
        options: edit?.options?.map((option) => option.value),
        onCommit: edit ? async (next: string) => edit.onSave(record, next) : undefined,
      } satisfies WireframeInspectorField;
    });

  return <WireframeRecordInspector fields={fields} />;
}
