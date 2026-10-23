import { z } from "zod";
import type { CreateFieldWidth } from "../../components/forms/CreateForm";

export type TransactionCreateFormValues = {
  id: string; receiptID: string; item: string; firstReceiptItem: string; categoryID: string; subcategoryID: string;
  merchantCode: string; transactionDate: string; quantity: string; regularPrice: string; paidPrice: string; total: string; discount: string; notes: string;
};
type Option = { value: string; label: string };
export type TransactionFieldDefinition = { name: keyof TransactionCreateFormValues; label: string; schema: z.ZodTypeAny; required?: boolean; type?: "text" | "date"; width?: CreateFieldWidth; multiline?: boolean; options?: readonly Option[] };
const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optional = z.string();
const number = z.string().refine((value) => value === "" || (/^\d+(\.\d+)?$/.test(value) && Number(value) >= 0), "Enter a non-negative number.");

/** Build the canonical Transaction field contract from the current category options. */
export function createTransactionFieldDefinitions(options: { categories: readonly Option[]; subcategories: readonly Option[] }): readonly TransactionFieldDefinition[] {
  return [
    { name: "id", label: "Stable transaction ID", schema: required("Transaction ID"), required: true },
    { name: "receiptID", label: "Receipt ID", schema: optional },
    { name: "item", label: "Item", schema: required("Item"), required: true },
    { name: "merchantCode", label: "Merchant code", schema: optional },
    { name: "transactionDate", label: "Transaction date", schema: optional, type: "date" },
    { name: "quantity", label: "Quantity", schema: required("Quantity").regex(/^\d+(\.\d+)?$/, "Enter a positive number.").refine((value) => Number(value) > 0, "Quantity must be greater than zero."), required: true },
    { name: "regularPrice", label: "Regular price", schema: number },
    { name: "paidPrice", label: "Paid price", schema: number },
    { name: "total", label: "Total", schema: number },
    { name: "discount", label: "Discount", schema: number },
    { name: "notes", label: "Notes", schema: optional, multiline: true },
    { name: "categoryID", label: "Category", schema: required("Category ID").regex(/^\d+$/, "Select a category.").refine((value) => Number(value) > 0, "Select a category."), options: options.categories },
    { name: "subcategoryID", label: "Subcategory", schema: optional, options: options.subcategories },
    { name: "firstReceiptItem", label: "First item on receipt", schema: optional, options: [{ value: "false", label: "No" }, { value: "true", label: "Yes" }] },
  ];
}

/** Build the Transaction schema from the same field contract used to render it. */
export function createTransactionSchema(fields: readonly TransactionFieldDefinition[]) {
  return z.object(Object.fromEntries(fields.map((field) => [field.name, field.schema])) as Record<keyof TransactionCreateFormValues, z.ZodTypeAny>);
}
