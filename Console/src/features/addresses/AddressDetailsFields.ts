// AddressDetailFields.ts
import type { Address } from "../../types";
import {
  formatRecordDate,
  formatRecordTimestamp,
  type EditableRecordField,
} from "../../components/EditableRecordFields";

export function getAddressDetailFields(
  record: Address,
  onPatch: (values: Partial<Address>) => Promise<void>,
): EditableRecordField[] {
  return [
    {
      label: "Address type",
      value: record.addressType,
      required: true,
      inputType: "select",
      options: [
        { label: "Residence", value: "Residence" },
        { label: "Storage", value: "Storage" },
        { label: "Work", value: "Work" },
        { label: "School", value: "School" },
        { label: "Other", value: "Other" },
      ],
      onSave: async (value) => onPatch({ addressType: String(value) }),
    },
    {
      label: "Address line 1",
      value: record.addressLine1,
      nullable: true,
      onSave: async (value) => onPatch({ addressLine1: value as string | null }),
    },
    {
      label: "Address line 2",
      value: record.addressLine2,
      nullable: true,
      onSave: async (value) => onPatch({ addressLine2: value as string | null }),
    },
    {
      label: "City",
      value: record.city,
      nullable: true,
      onSave: async (value) => onPatch({ city: value as string | null }),
    },
    {
      label: "State",
      value: record.state,
      nullable: true,
      onSave: async (value) => onPatch({ state: value as string | null }),
    },
    {
      label: "Postal code",
      value: record.postalCode,
      nullable: true,
      onSave: async (value) => onPatch({ postalCode: value as string | null }),
    },
    {
      label: "Country",
      value: record.country,
      required: true,
      onSave: async (value) => onPatch({ country: String(value) }),
    },
    {
      label: "Start date",
      value: record.startDate,
      inputType: "date",
      className: "record-field-compact",
      nullable: true,
      displayValue: formatRecordDate(record.startDate),
      onSave: async (value) => onPatch({ startDate: value as string | null }),
    },
    {
      label: "End date",
      value: record.endDate,
      inputType: "date",
      className: "record-field-compact",
      nullable: true,
      displayValue: formatRecordDate(record.endDate),
      onSave: async (value) => onPatch({ endDate: value as string | null }),
    },
    {
      label: "Address status",
      value: record.addressStatus,
      required: true,
      inputType: "select",
      className: "record-field-compact",
      options: [
        { label: "Current", value: "Current" },
        { label: "Former", value: "Former" },
        { label: "Seasonal", value: "Seasonal" },
        { label: "Other", value: "Other" },
      ],
      onSave: async (value) => onPatch({ addressStatus: String(value) }),
    },
    {
      label: "Notes",
      value: record.notes,
      inputType: "longText",
      nullable: true,
      className: "record-notes",
      onSave: async (value) => onPatch({ notes: value as string | null }),
    },
    {
      label: "Last updated",
      value: record.updatedAt,
      readOnlyReason: "Server managed",
      displayValue: formatRecordTimestamp(record.updatedAt),
    },
  ];
}
