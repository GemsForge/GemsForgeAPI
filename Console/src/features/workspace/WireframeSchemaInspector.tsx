import type { RecordPropertyDefinition } from "../../table-kit";
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
  const fields = properties
    .filter((property) => property.visible !== false)
    .map((property) => {
      const value = property.getValue(record);
      const edit = property.edit;
      return {
        id: property.id,
        label: property.label,
        value: typeof value.raw === "string" || typeof value.raw === "number" ? String(value.raw) : "",
        kind: editorKind(property.kind, edit?.inputType),
        options: edit?.options?.map((option) => option.value),
        onCommit: edit ? async (next: string) => edit.onSave(record, next) : undefined,
      } satisfies WireframeInspectorField;
    });

  return <WireframeRecordInspector fields={fields} />;
}
