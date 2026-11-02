import type { LiveSchemaTable } from "../types";
import type { RecordAdapter, RecordStorageType } from "./recordContracts";

/** Shared boundary between API-backed table data, storage metadata, and UI renderers. */
export interface TableWorkspaceDefinition<Row extends { id: string }> {
  tableName: string;
  schema?: LiveSchemaTable;
  adapter: RecordAdapter<Row>;
  /** Storage metadata is kept alongside presentation metadata for schema editing. */
  storageTypes?: Readonly<globalThis.Record<string, RecordStorageType>>;
}

export function createTableWorkspaceDefinition<Row extends { id: string }>(
  definition: TableWorkspaceDefinition<Row>,
): TableWorkspaceDefinition<Row> {
  return definition;
}
