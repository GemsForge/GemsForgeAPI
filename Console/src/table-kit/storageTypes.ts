import type { LiveSchemaColumn } from "../types";
import type { RecordPropertyKind, RecordStorageType } from "./recordContracts";

/** Normalize SQLite/API column declarations into the storage vocabulary used by Table Kit. */
export function normalizeStorageType(dataType: string | null | undefined): RecordStorageType {
  const normalized = (dataType ?? "").trim().toLowerCase();
  if (normalized.includes("bool")) return "boolean";
  if (normalized.includes("int")) return "integer";
  if (
    normalized.includes("real") ||
    normalized.includes("double") ||
    normalized.includes("float") ||
    normalized.includes("decimal") ||
    normalized.includes("numeric")
  )
    return "real";
  if (normalized.includes("blob")) return "blob";
  if (normalized.includes("date") || normalized.includes("time")) return "date";
  if (normalized.includes("char") || normalized.includes("clob") || normalized.includes("text")) return "text";
  return "unknown";
}

/** Provide a conservative UI primitive when a table has no explicit presentation metadata. */
export function inferRecordPropertyKind(column: Pick<LiveSchemaColumn, "name" | "dataType">): RecordPropertyKind {
  const name = column.name.toLowerCase();
  const storageType = normalizeStorageType(column.dataType);
  if (name.includes("date") || name.endsWith("at") || storageType === "date") return "date";
  if (storageType === "integer" || storageType === "real") return "number";
  if (storageType === "boolean") return "checkbox";
  if (name.includes("status")) return "status";
  if (name.includes("url") || name.includes("website")) return "url";
  if (name.includes("email")) return "email";
  return "text";
}
