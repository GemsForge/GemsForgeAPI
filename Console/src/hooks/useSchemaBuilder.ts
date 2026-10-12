import { useEffect, useState } from "react";
import { api } from "../api";
import type { HomeInventoryCSVPreview, SchemaBuilderGuidance, TableBuilderColumn, TableBuilderRequest, UserTablePreview } from "../types";

const types = ["TEXT", "INTEGER", "REAL", "NUMERIC", "BLOB", "ANY"] as const;
const initialColumns: TableBuilderColumn[] = [
  { name: "Property", dataType: "TEXT", nullable: true, defaultValue: null, primaryKey: false, unique: false },
];
const tableNamePattern = /^[A-Z][A-Za-z0-9]*$/;

interface UseSchemaBuilderOptions {
  onError: (error: unknown) => void;
  onSuccess: (message: string) => void;
}

/** Owns schema preview, table creation, and CSV-import workflow state. */
export function useSchemaBuilder({ onError, onSuccess }: UseSchemaBuilderOptions) {
  const [tableName, setTableName] = useState("HomeInventoryDraft");
  const [columns, setColumns] = useState(initialColumns);
  const [preview, setPreview] = useState<UserTablePreview | null>(null);
  const [csv, setCsv] = useState("");
  const [csvPreview, setCsvPreview] = useState<HomeInventoryCSVPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<SchemaBuilderGuidance | null>(null);
  const [guidanceError, setGuidanceError] = useState<string | null>(null);

  useEffect(() => {
    void api.getSchemaBuilderGuidance()
      .then(setGuidance)
      .catch((error: unknown) => setGuidanceError(error instanceof Error ? error.message : "Schema guidance could not be loaded."));
  }, []);

  const definition: TableBuilderRequest = { tableName, columns };
  const tableNameIsValid = tableNamePattern.test(tableName.trim());
  const columnsAreValid = columns.length >= 1 && columns.every((column) => column.name.trim() && column.dataType);

  function addColumn() {
    setColumns((current) => [...current, { name: "Property", dataType: "TEXT", nullable: true, defaultValue: null, primaryKey: false, unique: false }]);
  }

  function updateColumn(index: number, patch: Partial<TableBuilderColumn>) {
    setColumns((current) => current.map((column, columnIndex) => columnIndex === index ? { ...column, ...patch } : column));
  }

  function removeColumn(index: number) {
    setColumns((current) => current.filter((_, columnIndex) => columnIndex !== index));
  }

  async function previewTable() {
    setBusy(true);
    setCreationError(null);
    try { setPreview(await api.previewUserTable(definition)); } catch (error) { onError(error); } finally { setBusy(false); }
  }

  async function createTable() {
    if (!preview) return;
    setBusy(true);
    setCreationError(null);
    try {
      const result = await api.createUserTable(preview.confirmationToken);
      onSuccess(`${result.table} created and verified.`);
      setPreview(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The table could not be created.";
      setCreationError(message);
      onError(error);
    } finally { setBusy(false); }
  }

  async function previewImport() {
    setBusy(true);
    try { setCsvPreview(await api.previewHomeInventoryCSV(csv)); } catch (error) { onError(error); } finally { setBusy(false); }
  }

  async function importCSV() {
    setBusy(true);
    try { const result = await api.importHomeInventoryCSV(csv); onSuccess(`Imported ${result.importedCount} HomeInventory records.`); setCsvPreview(null); } catch (error) { onError(error); } finally { setBusy(false); }
  }

  function readCSV(file: File) {
    void file.text().then(setCsv).catch(onError);
  }

  return { types, tableName, setTableName, columns, preview, csv, setCsv, csvPreview, busy, creationError, guidance, guidanceError, definition, tableNameIsValid, columnsAreValid, addColumn, updateColumn, removeColumn, previewTable, createTable, previewImport, importCSV, readCSV };
}
