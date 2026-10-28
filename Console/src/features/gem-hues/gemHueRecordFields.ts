import type { EditableRecordField } from "../../components/EditableRecordFields";
import { withCurrentRecordOption } from "../../components/recordFieldOptions";
import type { GemHue } from "../../types";
import { gemHueFieldDefinitions } from "./gemHueFields";

export function gemHueEditableFields(
  hue: GemHue,
  onPatch: (values: Partial<GemHue>) => Promise<void>,
): EditableRecordField[] {
  return gemHueFieldDefinitions
    .filter((field) => field.name !== "id")
    .map((field) => ({
      label: field.label,
      value: hue[field.name],
      editable: true,
      inputType: field.options ? "select" as const : field.multiline ? "longText" as const : field.primitive === "date" ? "date" as const : "text" as const,
      primitive: field.primitive === "text" ? undefined : field.primitive,
      options: field.options ? withCurrentRecordOption(field.options, hue[field.name]) : undefined,
      required: field.required,
      nullable: !field.required,
      hideLabel: field.name === "colorName",
      className: field.name === "colorName" ? "hue-title-value" : field.name === "notes" ? "record-notes" : undefined,
      onSave: async (value) => onPatch({ [field.name]: value } as Partial<GemHue>),
    }));
}
