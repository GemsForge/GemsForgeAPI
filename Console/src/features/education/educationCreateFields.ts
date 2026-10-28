import { z } from "zod";
import type { CreateFieldWidth } from "../../components/forms/CreateForm";
import type { GemPrimitiveType } from "../../components/ui/primitiveFieldContracts";
import type { RecordSelectOption } from "../../table-kit/recordContracts";
import type { Address } from "../../types";

/** Raw Education values owned by React Hook Form before API normalization. */
export type EducationCreateFormValues = {
  id: string;
  educationType: string;
  institutionName: string;
  program: string;
  fieldOfStudy: string;
  credential: string;
  credentialID: string;
  startDate: string;
  endDate: string;
  awardedDate: string;
  status: string;
  locationAddressID: string;
  website: string;
  notes: string;
};

export type EducationFieldDefinition = {
  name: keyof EducationCreateFormValues;
  label: string;
  schema: z.ZodTypeAny;
  required?: boolean;
  type?: "text" | "date" | "url";
  width?: CreateFieldWidth;
  multiline?: boolean;
  primitive?: GemPrimitiveType;
  options?: readonly RecordSelectOption[];
};

const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optional = z.string();
export const educationTypeOptions = ["Elementary School", "Middle School", "High School", "College", "High school", "Associate", "Bachelor", "Master", "Doctorate", "Certificate", "Other"].map(
  (value) => ({ value, label: value }),
);
export const educationStatusOptions: readonly RecordSelectOption[] = [
  { label: "In progress", value: "In progress", colorToken: "blue", group: "In progress" },
  { label: "Completed", value: "Completed", colorToken: "green", group: "Complete" },
  { label: "Paused", value: "Paused", colorToken: "gold", group: "To-do" },
  { label: "Other", value: "Other", colorToken: "gray", group: "Other" },
];

/** Canonical Education form field metadata and validation contract. */
export const educationFieldDefinitions: readonly EducationFieldDefinition[] = [
  { name: "id", label: "ID", schema: required("Education ID"), required: true, primitive: "id" },
  { name: "educationType", label: "Type", schema: required("Education type"), required: true, primitive: "select", options: educationTypeOptions },
  { name: "institutionName", label: "Institution", schema: required("Institution name"), required: true, primitive: "text" },
  { name: "program", label: "Program", schema: optional },
  { name: "fieldOfStudy", label: "Field of study", schema: optional },
  { name: "credential", label: "Credential", schema: optional },
  { name: "credentialID", label: "Credential ID", schema: optional },
  { name: "startDate", label: "Start date", schema: optional, type: "date", primitive: "date" },
  { name: "endDate", label: "End date", schema: optional, type: "date", primitive: "date" },
  { name: "awardedDate", label: "Awarded date", schema: optional, type: "date", primitive: "date" },
  { name: "status", label: "Status", schema: required("Status"), required: true, primitive: "status", options: educationStatusOptions },
  { name: "locationAddressID", label: "Location", schema: optional, primitive: "select", options: [] },
  { name: "website", label: "Website", schema: optional, type: "url", primitive: "url" },
  { name: "notes", label: "Notes", schema: optional, multiline: true },
];

export function educationFieldsWithAddresses(addresses: readonly Address[]): readonly EducationFieldDefinition[] {
  return educationFieldDefinitions.map((field) => field.name === "locationAddressID"
    ? { ...field, options: addresses.map((address) => ({
        value: address.id,
        label: [address.addressLine1, address.city, address.state, address.postalCode].filter(Boolean).join(", ") || address.id,
      })) }
    : field);
}

const educationShape = Object.fromEntries(educationFieldDefinitions.map((field) => [field.name, field.schema]));

/** Validate Education fields from the same contract used to render them. */
export const educationSchema = z.object(educationShape as Record<keyof EducationCreateFormValues, z.ZodTypeAny>);
