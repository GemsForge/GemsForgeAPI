import type { RecordNumberFormat } from "./recordContracts";

export function inferRecordNumberFormat(propertyID: string, label = ""): RecordNumberFormat {
  const searchable = `${propertyID} ${label}`.toLowerCase();
  if (/(amount|price|total|discount|cost|balance|payment|currency)/.test(searchable)) return "currency";
  if (/(percent|percentage|rate|apr)/.test(searchable)) return "percent";
  return "decimal";
}

export function formatRecordNumber(value: number | null | undefined, format: RecordNumberFormat = "decimal"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "Not recorded";
  if (format === "currency") return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
  if (format === "percent") return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}
