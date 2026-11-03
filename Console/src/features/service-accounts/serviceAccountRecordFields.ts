import {
  formatRecordCurrency, formatRecordDate, formatRecordPercentage, formatRecordTimestamp,
  type EditableRecordField,
} from "../../components/EditableRecordFields";
import type { ServiceAccount } from "../../types";
import { serviceAccountFieldsWithDue } from "./serviceAccountCreateFields";
import { withCurrentRecordOption } from "../../components/recordFieldOptions";

/** Reuse the add form's property definitions for editable Service Account values. */
export function serviceAccountEditableFields(
  record: ServiceAccount,
  onPatch: (values: Partial<ServiceAccount>) => Promise<void>,
): EditableRecordField[] {
  const fields = serviceAccountFieldsWithDue(record.due).map((field): EditableRecordField => {
    const isReadOnly = field.name === "associatedAddress";
    const numeric = field.name === "monthlyAmount" || field.name === "interestRate" || field.name === "apr";
    const value = record[field.name];
    return {
      label: field.label,
      value,
      inputType: field.options ? "select" : field.multiline ? "longText" : field.type ?? "text",
      primitive: field.primitive,
      options: field.options ? withCurrentRecordOption(field.options, value as string | null) : undefined,
      required: field.required,
      nullable: !field.required,
      step: numeric ? field.name === "monthlyAmount" ? "0.01" : "0.0001" : undefined,
      className: field.name === "notes" ? "record-notes" : undefined,
      displayValue: field.name === "monthlyAmount" ? formatRecordCurrency(record.monthlyAmount)
        : field.name === "interestRate" || field.name === "apr" ? formatRecordPercentage(value as number | null)
          : field.name === "since" ? formatRecordDate(record.since) : undefined,
      readOnlyReason: isReadOnly ? "Legacy address value; no normalized, validated address selector is available." : undefined,
      editable: !isReadOnly,
      onSave: isReadOnly ? undefined : async (next) => onPatch({ [field.name]: next } as Partial<ServiceAccount>),
    };
  });

  return [
    ...fields,
    { label: "Legacy logo lookup relationship", value: record.logoKey, readOnlyReason: "Legacy logo lookup relationship; no validated selector is available." },
    { label: "Email updated", value: record.emailUpdated, inputType: "boolean", displayValue: record.emailUpdated ? "TRUE" : "FALSE", onSave: async (value) => onPatch({ emailUpdated: Boolean(value) }) },
    { label: "Notion page", value: record.notionPage, inputType: "url", nullable: true, onSave: async (value) => onPatch({ notionPage: value as string | null }) },
    { label: "Last updated", value: record.updatedAt ?? null, readOnlyReason: "Server managed", displayValue: formatRecordTimestamp(record.updatedAt) },
  ];
}
