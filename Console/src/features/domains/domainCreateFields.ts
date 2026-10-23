import { z } from "zod";
import type { CreateFieldWidth } from "../../components/forms/CreateForm";

/** Raw Domain values owned by React Hook Form before API normalization. */
export type DomainCreateFormValues = { id: string; title: string; description: string };
export type DomainFieldDefinition = { name: keyof DomainCreateFormValues; label: string; schema: z.ZodTypeAny; required?: boolean; width?: CreateFieldWidth; multiline?: boolean };

/** Canonical Domain form field metadata and validation contract. */
export const domainFieldDefinitions: readonly DomainFieldDefinition[] = [
  { name: "id", label: "Stable ID (optional)", schema: z.string() },
  { name: "title", label: "Title", schema: z.string().trim().min(1, "Title is required."), required: true },
  { name: "description", label: "Description", schema: z.string().trim().min(1, "Description is required."), required: true, multiline: true },
];

/** Validate Domain fields from the same contract used to render them. */
export const domainSchema = z.object(Object.fromEntries(domainFieldDefinitions.map((field) => [field.name, field.schema])) as Record<keyof DomainCreateFormValues, z.ZodTypeAny>);
