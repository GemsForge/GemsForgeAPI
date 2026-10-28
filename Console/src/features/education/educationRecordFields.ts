import { formatRecordTimestamp, type EditableRecordField } from "../../components/EditableRecordFields";
import type { Address, Education } from "../../types";
import { educationFieldsWithAddresses } from "./educationCreateFields";
import { withCurrentRecordOption } from "../../components/recordFieldOptions";

/** The record dialog and add form use the same Education property contract. */
export function educationEditableFields(
  record: Education,
  addresses: readonly Address[],
  onPatch: (values: Partial<Education>) => Promise<void>,
): EditableRecordField[] {
  const fields: EditableRecordField[] = educationFieldsWithAddresses(addresses)
    .filter((field) => field.name !== "id")
    .map((field) => ({
      label: field.label,
      value: field.name === "locationAddressID" ? record.address?.id ?? record.locationAddressID ?? null : record[field.name],
      inputType: field.options ? "select" : field.multiline ? "longText" : field.type ?? "text",
      primitive: field.primitive === "text" ? undefined : field.primitive,
      options: field.options ? withCurrentRecordOption(field.options,
        field.name === "locationAddressID" ? record.address?.id ?? record.locationAddressID : record[field.name] as string | null,
      ) : undefined,
      required: field.required,
      nullable: !field.required,
      className: field.name === "notes" ? "record-notes" : undefined,
      displayValue: field.name === "locationAddressID" && record.address
        ? [record.address.addressLine1, record.address.city, record.address.state, record.address.postalCode].filter(Boolean).join(", ")
        : undefined,
      onSave: async (value) => onPatch({ [field.name]: value } as Partial<Education>),
    }));

  return [
    ...fields,
    {
      label: "Last updated",
      value: record.updatedAt ?? null,
      readOnlyReason: "Server managed",
      displayValue: formatRecordTimestamp(record.updatedAt),
    },
  ];
}
