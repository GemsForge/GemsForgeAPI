import { z } from "zod";
import type { CreateFieldWidth } from "../../components/forms/CreateForm";

/** Raw Address values owned by React Hook Form before API normalization. */
export type AddressCreateFormValues = {
  addressType: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  startDate: string;
  endDate: string;
  addressStatus: string;
  notes: string;
};

type Option = { value: string; label: string };
type schemaType = z.ZodType<AddressCreateFormValues[keyof AddressCreateFormValues]>;
export type AddressFieldDefinition =
  | {
      kind: "text";
      name: keyof AddressCreateFormValues;
      label: string;
      schema: schemaType;
      required?: boolean;
      type?: "text" | "date";
      step?: string;
      multiline?: boolean;
      width?: CreateFieldWidth;
      placeholder?: string;
    }
  | {
      kind: "select";
      name: keyof AddressCreateFormValues;
      label: string;
      schema: schemaType;
      required?: boolean;
      options: readonly Option[];
    };

const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optional = z.string();
function isValidDateInput(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
  );
}
const optionalLocation = optional.refine(
  (value) => !value.trim() || /^[\p{L}\p{M}0-9 .,'’&()/-]+$/u.test(value.trim()),
  "Enter a valid location.",
);
const optionalPostalCode = optional.refine(
  (value) => !value.trim() || /^[\p{L}\p{N}][\p{L}\p{N} .-]*$/u.test(value.trim()),
  "Enter a valid postal code.",
);
const optionalDate = optional.refine((value) => !value.trim() || isValidDateInput(value.trim()), "Enter a valid date.");

const addressTypeOptions = ["Residence", "Storage", "Work", "School", "Other"].map((value) => ({
  value,
  label: value,
}));
const addressStatusOptions = ["Current", "Former", "Seasonal", "Other"].map((value) => ({ value, label: value }));

/** Canonical Address form field metadata, validation, and control configuration. */
export const addressFieldDefinitions: readonly AddressFieldDefinition[] = [
  {
    kind: "select",
    name: "addressType",
    label: "Address type",
    schema: required("Address type"),
    required: true,
    options: addressTypeOptions,
  },
  { kind: "text", name: "addressLine1", label: "Address line 1", schema: optional, width: "long" },
  { kind: "text", name: "addressLine2", label: "Address line 2", schema: optional, width: "long" },
  { kind: "text", name: "country", label: "Country", schema: required("Country"), required: true, width: "medium" },
  { kind: "text", name: "city", label: "City", schema: optionalLocation, width: "short" },
  { kind: "text", name: "state", label: "State / region", schema: optionalLocation, width: "short" },
  { kind: "text", name: "postalCode", label: "Postal code", schema: optionalPostalCode, width: "short" },
  { kind: "text", name: "startDate", label: "Start date", schema: optionalDate, type: "date", width: "short" },
  { kind: "text", name: "endDate", label: "End date", schema: optionalDate, type: "date", width: "short" },
  {
    kind: "select",
    name: "addressStatus",
    label: "Status",
    schema: required("Status"),
    required: true,
    options: addressStatusOptions,
  },
  { kind: "text", name: "notes", label: "Notes", schema: optional, multiline: true, width: "long" },
];

const addressShape = Object.fromEntries(addressFieldDefinitions.map((field) => [field.name, field.schema]));

/** Validate Address fields from the same contract used to render them. */
export const addressSchema = z
  .object(addressShape as Record<keyof AddressCreateFormValues, z.ZodTypeAny>)
  .superRefine((values, context) => {
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date." });
    }
  });
