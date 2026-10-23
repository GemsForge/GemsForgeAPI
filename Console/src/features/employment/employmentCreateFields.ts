import { z } from "zod";
import type { CreateFieldWidth } from "../../components/forms/CreateForm";

/** Raw Employment values owned by React Hook Form before API normalization. */
export type EmploymentCreateFormValues = {
  id: string;
  employerName: string;
  employerType: string;
  industry: string;
  website: string;
  positionTitle: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  employmentStatus: string;
  workAddressID: string;
  employerContact: string;
  employerContactNumber: string;
  employerContactEmail: string;
  notes: string;
};

type Option = { value: string; label: string };
export type EmploymentFieldDefinition = {
  name: keyof EmploymentCreateFormValues;
  label: string;
  schema: z.ZodTypeAny;
  required?: boolean;
  type?: "text" | "date" | "url" | "tel" | "email";
  width?: CreateFieldWidth;
  multiline?: boolean;
  options?: readonly Option[];
};

const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optional = z.string();
function validDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.getUTCFullYear() === +year && date.getUTCMonth() + 1 === +month && date.getUTCDate() === +day;
}
const optionalDate = optional.refine((value) => !value.trim() || validDate(value.trim()), "Enter a valid date.");
const optionalURL = optional.refine((value) => {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}, "Enter a valid URL starting with http:// or https://.");
const optionalEmail = optional.refine((value) => !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()), "Enter a valid email address.");
const optionalPhone = optional.refine((value) => {
  const normalized = value.trim();
  if (!normalized) return true;
  return /^\+?[0-9().\-\s]+(?:\s*(?:x|ext\.?)\s*[0-9]+)?$/i.test(normalized) && (normalized.match(/\d/g) ?? []).length >= 7;
}, "Enter a valid phone number.");

/** Build the canonical Employment field contract from feature-supplied options. */
export function createEmploymentFieldDefinitions(options: {
  employerType: readonly Option[];
  industry: readonly Option[];
  employmentType: readonly Option[];
  status: readonly Option[];
  workAddress: readonly Option[];
}): readonly EmploymentFieldDefinition[] {
  return [
    { name: "employerName", label: "Employer name", schema: required("Employer name"), required: true },
    { name: "employerType", label: "Employer type", schema: required("Employer type"), required: true, options: options.employerType },
    { name: "industry", label: "Industry", schema: optional, options: options.industry },
    { name: "website", label: "Website", schema: optionalURL, type: "url", width: "medium" },
    { name: "positionTitle", label: "Position title", schema: required("Position title"), required: true },
    { name: "employmentType", label: "Employment type", schema: required("Employment type"), required: true, options: options.employmentType },
    { name: "startDate", label: "Start date", schema: optionalDate, type: "date", width: "short" },
    { name: "endDate", label: "End date", schema: optionalDate, type: "date", width: "short" },
    { name: "employmentStatus", label: "Status", schema: required("Status"), required: true, options: options.status },
    { name: "employerContact", label: "Contact", schema: optional },
    { name: "employerContactNumber", label: "Contact number", schema: optionalPhone, type: "tel", width: "short" },
    { name: "employerContactEmail", label: "Contact email", schema: optionalEmail, type: "email", width: "medium" },
    { name: "notes", label: "Notes", schema: optional, multiline: true },
    { name: "workAddressID", label: "Work address", schema: optional, options: options.workAddress },
  ];
}

/** Build the Employment object schema from the same field contract used to render it. */
export function createEmploymentSchema(fields: readonly EmploymentFieldDefinition[]) {
  const shape = Object.fromEntries(fields.map((field) => [field.name, field.schema]));
  return z.object(shape as Record<keyof EmploymentCreateFormValues, z.ZodTypeAny>).superRefine((values, context) => {
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date." });
    }
  });
}
