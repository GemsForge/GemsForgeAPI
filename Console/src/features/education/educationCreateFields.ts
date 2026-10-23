import { z } from "zod";
import type { CreateFieldWidth } from "../../components/forms/CreateForm";

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

type Option = { value: string; label: string };
export type EducationFieldDefinition = {
  name: keyof EducationCreateFormValues;
  label: string;
  schema: z.ZodTypeAny;
  required?: boolean;
  type?: "text" | "date" | "url";
  width?: CreateFieldWidth;
  multiline?: boolean;
  options?: readonly Option[];
};

const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optional = z.string();
const educationTypeOptions = ["High school", "Associate", "Bachelor", "Master", "Doctorate", "Certificate", "Other"].map(
  (value) => ({ value, label: value }),
);
const statusOptions = ["In progress", "Completed", "Paused", "Other"].map((value) => ({ value, label: value }));

/** Canonical Education form field metadata and validation contract. */
export const educationFieldDefinitions: readonly EducationFieldDefinition[] = [
  { name: "id", label: "Stable education ID", schema: required("Education ID"), required: true },
  { name: "educationType", label: "Education type", schema: required("Education type"), required: true, options: educationTypeOptions },
  { name: "institutionName", label: "Institution name", schema: required("Institution name"), required: true },
  { name: "program", label: "Program", schema: optional },
  { name: "fieldOfStudy", label: "Field of study", schema: optional },
  { name: "credential", label: "Credential", schema: optional },
  { name: "credentialID", label: "Credential ID", schema: optional },
  { name: "startDate", label: "Start date", schema: optional, type: "date" },
  { name: "endDate", label: "End date", schema: optional, type: "date" },
  { name: "awardedDate", label: "Awarded date", schema: optional, type: "date" },
  { name: "status", label: "Status", schema: required("Status"), required: true, options: statusOptions },
  { name: "website", label: "Website", schema: optional, type: "url" },
  { name: "notes", label: "Notes", schema: optional, multiline: true },
];

const educationShape = Object.fromEntries(educationFieldDefinitions.map((field) => [field.name, field.schema]));

/** Validate Education fields from the same contract used to render them. */
export const educationSchema = z.object(educationShape as Record<keyof EducationCreateFormValues, z.ZodTypeAny>);
