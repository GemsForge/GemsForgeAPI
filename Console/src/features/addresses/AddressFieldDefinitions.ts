import { z } from "zod";

export type AddressFieldWidth = "short" | "medium" | "long";

/** Presentation metadata shared by create and edit address controls. */
export const addressFieldDefinitions = {
  addressType: { label: "Address type", width: "medium" as AddressFieldWidth, placeholder: "Select…" },
  addressLine1: { label: "Address line 1", width: "long" as AddressFieldWidth, placeholder: "Enter address line 1…" },
  addressLine2: { label: "Address line 2", width: "long" as AddressFieldWidth, placeholder: "Enter address line 2…" },
  country: { label: "Country", width: "medium" as AddressFieldWidth, placeholder: "Enter country…" },
  city: { label: "City", width: "short" as AddressFieldWidth, placeholder: "Enter city…" },
  state: { label: "State / region", width: "short" as AddressFieldWidth, placeholder: "Enter state / region…" },
  postalCode: { label: "Postal code", width: "short" as AddressFieldWidth, placeholder: "Enter postal code…" },
  startDate: { label: "Start date", width: "short" as AddressFieldWidth, placeholder: "YYYY-MM-DD" },
  endDate: { label: "End date", width: "short" as AddressFieldWidth, placeholder: "YYYY-MM-DD" },
  addressStatus: { label: "Status", width: "short" as AddressFieldWidth, placeholder: "Select…" },
  notes: { label: "Notes", width: "long" as AddressFieldWidth, placeholder: "Enter notes…" },
} as const;

export const addressTypeOptions = ["Residence", "Storage", "Work", "School", "Other"].map((value) => ({
  value,
  label: value,
}));
export const addressStatusOptions = ["Current", "Former", "Seasonal", "Other"].map((value) => ({
  value,
  label: value,
}));

const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optional = z.string();
const addressDate = optional.refine((value) => {
  if (!value.trim()) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const date = new Date(`${value.trim()}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
  );
}, "Enter a valid date.");

/** Shared Address create/edit validation schema. */
export const addressSchema = z
  .object({
    addressType: required("Address type"),
    addressLine1: optional,
    addressLine2: optional,
    city: optional.refine(
      (value) => !value.trim() || /^[\p{L}\p{M}0-9 .,'’&()/-]+$/u.test(value.trim()),
      "Enter a valid location.",
    ),
    state: optional.refine(
      (value) => !value.trim() || /^[\p{L}\p{M}0-9 .,'’&()/-]+$/u.test(value.trim()),
      "Enter a valid location.",
    ),
    postalCode: optional.refine(
      (value) => !value.trim() || /^[\p{L}\p{N}][\p{L}\p{N} .-]*$/u.test(value.trim()),
      "Enter a valid postal code.",
    ),
    country: required("Country"),
    startDate: addressDate,
    endDate: addressDate,
    addressStatus: required("Status"),
    notes: optional,
  })
  .superRefine((values, context) => {
    if (values.startDate && values.endDate && values.endDate < values.startDate)
      context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date." });
  });
