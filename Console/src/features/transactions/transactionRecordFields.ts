import { formatRecordCurrency, formatRecordDate, formatRecordTimestamp, type EditableRecordField, type EditableValue } from "../../components/EditableRecordFields";
import type { ExpenseCategory, ExpenseSubcategory, ExpenseTransaction, Merchant } from "../../types";
import { createTransactionFieldDefinitions, transactionMerchantOptions } from "./transactionCreateFields";
import { withCurrentRecordOption } from "../../components/recordFieldOptions";

/** The transaction dialog binds record values to the add form's property definitions. */
export function transactionEditableFields(
  record: ExpenseTransaction,
  categories: readonly ExpenseCategory[],
  subcategories: readonly ExpenseSubcategory[],
  merchants: readonly Merchant[],
  onPatch: (values: Partial<ExpenseTransaction>) => Promise<void>,
): EditableRecordField[] {
  const definitions = createTransactionFieldDefinitions({
    categories: categories.map((category) => ({ value: String(category.id), label: category.name })),
    subcategories: subcategories.map((subcategory) => ({ value: String(subcategory.id), label: subcategory.name })),
    merchants: transactionMerchantOptions(merchants),
  });
  const currencyFields = new Set(["regularPrice", "paidPrice", "total", "discount"]);
  return [
    ...definitions.filter((field) => field.name !== "id").map((field): EditableRecordField => {
      const raw = record[field.name];
      const selectValue = field.options && raw != null ? String(raw) : raw;
      return {
        label: field.label,
        value: selectValue,
        inputType: field.primitive === "checkbox" ? "boolean" : field.options ? "select" : field.multiline ? "longText" : field.type ?? "text",
        options: field.options ? withCurrentRecordOption(field.options, raw as string | number | null) : undefined,
        required: field.required,
        nullable: !field.required,
        step: field.type === "number" ? "0.01" : undefined,
        className: field.name === "notes" ? "record-notes" : undefined,
        displayValue: field.type === "date" ? formatRecordDate(raw as string | null)
          : currencyFields.has(field.name) ? formatRecordCurrency(raw as number | null)
            : field.options ? field.options.find((option) => option.value === String(raw))?.label : undefined,
        onSave: async (value: EditableValue) => {
          const next = field.name === "categoryID" || field.name === "subcategoryID"
            ? value == null || value === "" ? null : Number(value)
            : value;
          await onPatch({ [field.name]: next } as Partial<ExpenseTransaction>);
        },
      };
    }),
    { label: "Last updated", value: record.updatedAt ?? null, readOnlyReason: "Server managed", displayValue: formatRecordTimestamp(record.updatedAt) },
  ];
}
