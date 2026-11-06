import type { LiveSchemaTable } from "../types";
import type { RecordPropertyDefinition } from "./recordContracts";
import { inferRecordPropertyKind, normalizeStorageType } from "./storageTypes";

/** Build a domain-neutral property schema from the API's live database metadata. */
export function createLiveSchemaProperties<Row extends globalThis.Record<string, unknown>>(
  table: Pick<LiveSchemaTable, "columns">,
  onSave?: (record: Row, columnName: string, value: string | number | null) => Promise<void>,
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
    ...(onSave && !column.primaryKey && column.name !== "HubID" && !column.dataType.toUpperCase().includes("BLOB")
      ? {
          edit: {
            inputType: /INT|REAL|NUMERIC|DECIMAL|FLOAT|DOUBLE/i.test(column.dataType)
              ? ("number" as const)
              : /DATE|TIME/i.test(column.dataType) || /date|time|createdat|updatedat/i.test(column.name)
                ? ("date" as const)
                : ("text" as const),
            nullable: column.nullable,
            onSave: (record: unknown, value: string | number | null) =>
              onSave(record as Row, column.name, value),
          },
        }
      : {}),
    getValue: (record) => {
      const raw = record[column.name];
      return { raw, display: raw == null || raw === "" ? "—" : String(raw) };
    },
  }));
}
