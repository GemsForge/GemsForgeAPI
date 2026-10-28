import { formatRecordDate, formatRecordTimestamp, type EditableRecordField } from "../../components/EditableRecordFields";
import type { Employment } from "../../types";
import type { EmploymentFieldDefinition } from "./employmentCreateFields";
import { withCurrentRecordOption } from "../../components/recordFieldOptions";

/** Bind an Employment record to the definitions also used by its add form. */
export function employmentEditableFields(
  record: Employment,
  definitions: readonly EmploymentFieldDefinition[],
  onPatch: (values: Partial<Employment>) => Promise<void>,
): EditableRecordField[] {
  return [
    ...definitions.filter((field) => field.name !== "id").map((field): EditableRecordField => ({
      label: field.label,
      value: field.name === "workAddressID" ? record.address?.id ?? record.workAddressID ?? null : record[field.name],
      inputType: field.options ? "select" : field.multiline ? "longText" : field.type ?? "text",
      primitive: field.name === "employmentStatus" ? "status" : undefined,
      options: field.options ? withCurrentRecordOption(field.options,
        field.name === "workAddressID" ? record.address?.id ?? record.workAddressID : record[field.name] as string | null,
      ) : undefined,
      required: field.required,
      nullable: !field.required,
      className: field.name === "notes" ? "record-notes" : undefined,
      displayValue: field.type === "date" ? formatRecordDate(record[field.name] as string | null)
        : field.name === "workAddressID" && record.address
          ? [record.address.addressLine1, record.address.city, record.address.state, record.address.postalCode].filter(Boolean).join(", ")
          : undefined,
      onSave: async (value) => onPatch({ [field.name]: value } as Partial<Employment>),
    })),
    {
      label: "Last updated",
      value: record.updatedAt ?? null,
      readOnlyReason: "Server managed",
      displayValue: formatRecordTimestamp(record.updatedAt),
    },
  ];
}
