import { formatRecordDate, formatRecordTimestamp, type EditableRecordField } from "../../components/EditableRecordFields";
import type { Address } from "../../types";
import { addressFieldDefinitions } from "./addressCreateFields";
import { withCurrentRecordOption } from "../../components/recordFieldOptions";

/** Bind Address values and save callbacks to the create form's property definitions. */
export function addressEditableFields(
  record: Address,
  onPatch: (values: Partial<Address>) => Promise<void>,
): EditableRecordField[] {
  return [
    ...addressFieldDefinitions.map((field): EditableRecordField => ({
      label: field.label,
      value: record[field.name],
      inputType: field.kind === "select" ? "select" : field.multiline ? "longText" : field.type ?? "text",
      primitive: field.primitive,
      options: field.kind === "select" ? withCurrentRecordOption(field.options, record[field.name] as string | null) : undefined,
      required: field.required,
      nullable: !field.required,
      className: field.name === "notes" ? "record-notes" : undefined,
      displayValue: field.kind === "text" && field.type === "date"
        ? formatRecordDate(record[field.name] as string | null) : undefined,
      onSave: async (value) => onPatch({ [field.name]: value } as Partial<Address>),
    })),
    {
      label: "Last updated",
      value: record.updatedAt ?? null,
      readOnlyReason: "Server managed",
      displayValue: formatRecordTimestamp(record.updatedAt),
    },
  ];
}
