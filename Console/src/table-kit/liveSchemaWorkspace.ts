import type { LiveSchemaTable } from "../types";
import type { RecordPropertyDefinition } from "./recordContracts";
import { inferRecordPropertyKind, normalizeStorageType } from "./storageTypes";

/** Build a domain-neutral property schema from the API's live database metadata. */
export function createLiveSchemaProperties<Row extends globalThis.Record<string, unknown>>(
  table: LiveSchemaTable,
): readonly RecordPropertyDefinition<Row>[] {
  return table.columns.map((column, index) => ({
    id: column.name,
    label: column.name
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/^./, (character) => character.toUpperCase()),
    storageType: normalizeStorageType(column.dataType),
    kind: inferRecordPropertyKind(column),
    order: index,
    primary: column.primaryKey,
    getValue: (record) => {
      const raw = record[column.name];
      return { raw, display: raw == null || raw === "" ? "—" : String(raw) };
    },
  }));
}
