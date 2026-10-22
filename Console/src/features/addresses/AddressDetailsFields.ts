// AddressDetailFields.ts
import type { Address } from "../../types";
import {
  formatRecordDate,
  formatRecordTimestamp,
  type EditableRecordField,
} from "../../components/EditableRecordFields";
import {
  addressFieldDefinitions,
  addressStatusOptions,
  addressTypeOptions,
  validateAddressField,
} from "./AddressFieldDefinitions";

export function getAddressDetailFields(
  record: Address,
  onPatch: (values: Partial<Address>) => Promise<void>,
): EditableRecordField[] {
  return [
    {
      label: addressFieldDefinitions.addressType.label,
      value: record.addressType,
      required: true,
      inputType: "dropdown",
      options: addressTypeOptions,
      validate: (value) => validateAddressField("addressType", value),
      onSave: async (value) => onPatch({ addressType: String(value) }),
    },
    {
      label: addressFieldDefinitions.addressLine1.label,
      value: record.addressLine1,
      nullable: true,
      validate: (value) => validateAddressField("addressLine1", value),
      onSave: async (value) => onPatch({ addressLine1: value as string | null }),
    },
    {
      label: addressFieldDefinitions.addressLine2.label,
      value: record.addressLine2,
      nullable: true,
      validate: (value) => validateAddressField("addressLine2", value),
      onSave: async (value) => onPatch({ addressLine2: value as string | null }),
    },
    {
      label: addressFieldDefinitions.city.label,
      value: record.city,
      nullable: true,
      validate: (value) => validateAddressField("city", value),
      onSave: async (value) => onPatch({ city: value as string | null }),
    },
    {
      label: addressFieldDefinitions.state.label,
      value: record.state,
      nullable: true,
      validate: (value) => validateAddressField("state", value),
      onSave: async (value) => onPatch({ state: value as string | null }),
    },
    {
      label: addressFieldDefinitions.postalCode.label,
      value: record.postalCode,
      nullable: true,
      validate: (value) => validateAddressField("postalCode", value),
      onSave: async (value) => onPatch({ postalCode: value as string | null }),
    },
    {
      label: addressFieldDefinitions.country.label,
      value: record.country,
      required: true,
      validate: (value) => validateAddressField("country", value),
      onSave: async (value) => onPatch({ country: String(value) }),
    },
    {
      label: addressFieldDefinitions.startDate.label,
      placeholder: addressFieldDefinitions.startDate.placeholder,
      value: record.startDate,
      inputType: "date",
      className: "record-field-compact",
      nullable: true,
      displayValue: formatRecordDate(record.startDate),
      onSave: async (value) => onPatch({ startDate: value as string | null }),
      validate: (value) => validateAddressField("startDate", value),
    },
    {
      label: addressFieldDefinitions.endDate.label,
      placeholder: addressFieldDefinitions.endDate.placeholder,
      value: record.endDate,
      inputType: "date",
      className: "record-field-compact",
      nullable: true,
      displayValue: formatRecordDate(record.endDate),
      onSave: async (value) => onPatch({ endDate: value as string | null }),
      validate: (value) => validateAddressField("endDate", value),
    },
    {
      label: addressFieldDefinitions.addressStatus.label,
      value: record.addressStatus,
      required: true,
      inputType: "dropdown",
      className: "record-field-compact",
      options: addressStatusOptions,
      validate: (value) => validateAddressField("addressStatus", value),
      onSave: async (value) => onPatch({ addressStatus: String(value) }),
    },
    {
      label: addressFieldDefinitions.notes.label,
      value: record.notes,
      inputType: "longText",
      nullable: true,
      className: "record-notes",
      onSave: async (value) => onPatch({ notes: value as string | null }),
      validate: (value) => validateAddressField("notes", value),
    },
    {
      label: "Last updated",
      value: record.updatedAt,
      readOnlyReason: "Server managed",
      displayValue: formatRecordTimestamp(record.updatedAt),
    },
  ];
}
