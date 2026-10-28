import { z } from "zod";
import type { CreateFieldWidth } from "../../components/forms/CreateForm";
import type { RecordSelectOption } from "../../table-kit/recordContracts";

/** Raw Service Account values owned by React Hook Form before API normalization. */
export type ServiceAccountCreateFormValues = {
  service: string; type: string; expenseGroup: string; monthlyAmount: string; interestRate: string; apr: string; due: string;
  occurrence: string; status: string; since: string; website: string; notes: string; paymentMethod: string; accountNumber: string;
  associatedAddress: string; serviceKey: string;
};
export type ServiceAccountFieldDefinition = { name: keyof ServiceAccountCreateFormValues; label: string; schema: z.ZodTypeAny; required?: boolean; type?: "text" | "number" | "date" | "url"; width?: CreateFieldWidth; multiline?: boolean; options?: readonly RecordSelectOption[]; primitive?: "status" };
const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optional = z.string();
const amount = z.string().refine((value) => value === "" || (/^\d+(\.\d+)?$/.test(value) && Number(value) >= 0), "Enter a non-negative number.");
const options = (values: readonly string[]): RecordSelectOption[] => values.map((value) => ({ value, label: value }));
const typeOptions = options(["Utility", "Subscription", "Credit", "Loan", "Insurance", "Membership", "Other"]);
const expenseGroupOptions = options(["Fixed Bills (Obligations)", "Variable Bills", "Home", "Lifestyle", "Other"]);
const dueOptions = options(["1st", "5th", "10th", "15th", "20th", "25th", "Last day of month"]);
const occurrenceOptions = options(["Monthly", "Quarterly", "Annually", "One-time", "As needed"]);
const paymentMethodOptions = options(["Apple", "Bank transfer", "Credit card", "Debit card", "PayPal", "Other"]);
const statusOptions: RecordSelectOption[] = [
  ["Active", "green"], ["Paused", "gold"], ["Closed", "gray"], ["Cancelled", "red"], ["Pending", "blue"],
].map(([value, colorToken]) => ({
  label: value, value, group: value === "Active" || value === "Pending" ? "Open" : "Closed",
  colorToken: colorToken as "green" | "gold" | "gray" | "red" | "blue",
}));

/** Canonical Service Account field metadata and validation contract. */
export const serviceAccountFieldDefinitions: readonly ServiceAccountFieldDefinition[] = [
  { name: "service", label: "Service", schema: required("Service"), required: true },
  { name: "type", label: "Type", schema: optional, options: typeOptions },
  { name: "expenseGroup", label: "Expense group", schema: optional, options: expenseGroupOptions },
  { name: "monthlyAmount", label: "Monthly amount", schema: amount, type: "number" },
  { name: "interestRate", label: "Interest rate", schema: amount, type: "number" },
  { name: "apr", label: "APR", schema: amount, type: "number" },
  { name: "due", label: "Due", schema: optional, options: dueOptions },
  { name: "occurrence", label: "Occurrence", schema: optional, options: occurrenceOptions },
  { name: "status", label: "Status", schema: optional, options: statusOptions, primitive: "status" },
  { name: "since", label: "Since", schema: optional, type: "date" },
  { name: "website", label: "Website", schema: optional, type: "url" },
  { name: "paymentMethod", label: "Payment method", schema: optional, options: paymentMethodOptions },
  { name: "accountNumber", label: "Account number", schema: optional },
  { name: "associatedAddress", label: "Associated address", schema: optional },
  { name: "serviceKey", label: "Service key", schema: optional },
  { name: "notes", label: "Notes", schema: optional, multiline: true },
];

export function serviceAccountFieldsWithDue(due: string | null | undefined): readonly ServiceAccountFieldDefinition[] {
  return serviceAccountFieldDefinitions.map((field) => field.name === "due" && due && !field.options?.some((option) => option.value === due)
    ? { ...field, options: [...(field.options ?? []), { value: due, label: due }] }
    : field);
}

/** Build the Service Account schema from the same field contract used to render it. */
export const serviceAccountSchema = z.object(Object.fromEntries(serviceAccountFieldDefinitions.map((field) => [field.name, field.schema])) as Record<keyof ServiceAccountCreateFormValues, z.ZodTypeAny>);
