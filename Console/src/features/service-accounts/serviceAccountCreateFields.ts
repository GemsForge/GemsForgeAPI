import { z } from "zod";
import type { CreateFieldWidth } from "../../components/forms/CreateForm";

/** Raw Service Account values owned by React Hook Form before API normalization. */
export type ServiceAccountCreateFormValues = {
  service: string; type: string; expenseGroup: string; monthlyAmount: string; interestRate: string; apr: string; due: string;
  occurrence: string; status: string; since: string; website: string; notes: string; paymentMethod: string; accountNumber: string;
  associatedAddress: string; serviceKey: string;
};
export type ServiceAccountFieldDefinition = { name: keyof ServiceAccountCreateFormValues; label: string; schema: z.ZodTypeAny; required?: boolean; type?: "text" | "date" | "url" | "number"; step?: string; width?: CreateFieldWidth; multiline?: boolean };
const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optional = z.string();
const amount = z.string().refine((value) => value === "" || (/^\d+(\.\d+)?$/.test(value) && Number(value) >= 0), "Enter a non-negative number.");

/** Canonical Service Account field metadata and validation contract. */
export const serviceAccountFieldDefinitions: readonly ServiceAccountFieldDefinition[] = [
  { name: "service", label: "Service name", schema: required("Service name"), required: true },
  { name: "type", label: "Type", schema: optional },
  { name: "expenseGroup", label: "Expense group", schema: optional },
  { name: "monthlyAmount", label: "Monthly amount", schema: amount, type: "number", step: "0.01" },
  { name: "interestRate", label: "Interest rate", schema: amount, type: "number", step: "0.01" },
  { name: "apr", label: "APR", schema: amount, type: "number", step: "0.01" },
  { name: "due", label: "Due date", schema: optional, type: "date" },
  { name: "occurrence", label: "Occurrence", schema: optional },
  { name: "status", label: "Status", schema: optional },
  { name: "since", label: "Since", schema: optional, type: "date" },
  { name: "website", label: "Website", schema: optional, type: "url" },
  { name: "paymentMethod", label: "Payment method", schema: optional },
  { name: "accountNumber", label: "Account number", schema: optional },
  { name: "associatedAddress", label: "Associated address", schema: optional },
  { name: "serviceKey", label: "Service key", schema: optional },
  { name: "notes", label: "Notes", schema: optional, multiline: true },
];

/** Build the Service Account schema from the same field contract used to render it. */
export const serviceAccountSchema = z.object(Object.fromEntries(serviceAccountFieldDefinitions.map((field) => [field.name, field.schema])) as Record<keyof ServiceAccountCreateFormValues, z.ZodTypeAny>);
