import type { RecordColorToken, RecordDateFormat, RecordNumberFormat } from "./recordContracts";

/** Shared semantic defaults for primitive data-type views. */
export const primitiveTypeDefaults = {
  status: { colorToken: "mint" as RecordColorToken },
  number: { numberFormat: "decimal" as RecordNumberFormat },
  date: { dateFormat: "local" as RecordDateFormat },
} as const;

/** Product-facing descriptions used by primitive type pickers and help tooltips. */
export const primitiveTypeDescriptions = {
  status: "Track this item’s progress using status tags categorized by To-do, In progress, and Complete.",
} as const;
