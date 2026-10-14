import { useReducer, useRef } from "react";
import { useSchemaGuidanceQuery, usePreviewTableMutation, useCreateTableMutation, usePreviewCSVMutation, useImportCSVMutation } from "../data/workflowQueries";
import type { HomeInventoryCSVPreview, TableBuilderColumn, TableBuilderRequest, UserTablePreview } from "../types";

const types = ["TEXT", "INTEGER", "REAL", "NUMERIC", "BLOB", "ANY"] as const;
const newColumn = (): TableBuilderColumn => ({ name: "Property", dataType: "TEXT", nullable: true, defaultValue: null, primaryKey: false, unique: false });
interface State {
  tableName: string; columns: TableBuilderColumn[]; preview: UserTablePreview | null;
  csv: string; csvPreview: HomeInventoryCSVPreview | null; busy: boolean;
  creationError: string | null; revision: number;
}
export const initialBuilderState: State = { tableName: "HomeInventoryDraft", columns: [newColumn()], preview: null, csv: "", csvPreview: null, busy: false, creationError: null, revision: 0 };
export type BuilderAction =
  | { type: "tableName"; value: string }
  | { type: "columns"; value: TableBuilderColumn[] }
  | { type: "csv"; value: string }
  | { type: "start" | "finish" | "created" | "imported" }
  | { type: "preview"; value: UserTablePreview; revision: number }
  | { type: "csvPreview"; value: HomeInventoryCSVPreview; revision: number }
  | { type: "creationError"; value: string };

export function builderReducer(state: State, action: BuilderAction): State {
  switch (action.type) {
    case "tableName": return { ...state, tableName: action.value, preview: null, creationError: null, revision: state.revision + 1 };
    case "columns": return { ...state, columns: action.value, preview: null, creationError: null, revision: state.revision + 1 };
    case "csv": return { ...state, csv: action.value, csvPreview: null, revision: state.revision + 1 };
    case "start": return { ...state, busy: true, creationError: null };
    case "finish": return { ...state, busy: false };
    case "preview": return action.revision === state.revision ? { ...state, preview: action.value } : state;
    case "csvPreview": return action.revision === state.revision ? { ...state, csvPreview: action.value } : state;
    case "created": return { ...state, preview: null };
    case "imported": return { ...state, csvPreview: null };
    case "creationError": return { ...state, creationError: action.value };
  }
}

interface Options { onError: (error: unknown) => void; onSuccess: (message: string) => void }

/** Drafts and approvals belong here; server reads/writes belong to query hooks. */
export function useSchemaBuilder({ onError, onSuccess }: Options) {
  const [state, dispatch] = useReducer(builderReducer, initialBuilderState);
  const running = useRef(false);
  const csvRead = useRef(0);
  const guidanceQuery = useSchemaGuidanceQuery();
  const tablePreview = usePreviewTableMutation();
  const tableCreation = useCreateTableMutation();
  const csvPreviewMutation = usePreviewCSVMutation();
  const csvImport = useImportCSVMutation();
  const definition: TableBuilderRequest = { tableName: state.tableName, columns: state.columns };
  const tableNameIsValid = /^[A-Z][A-Za-z0-9]*$/.test(state.tableName.trim());
  const columnsAreValid = state.columns.length >= 1 && state.columns.every((column) => column.name.trim() && column.dataType);
  const setTableName = (value: string) => dispatch({ type: "tableName", value });
  const setCsv = (value: string) => { csvRead.current++; dispatch({ type: "csv", value }); };
  const addColumn = () => dispatch({ type: "columns", value: [...state.columns, newColumn()] });
  const updateColumn = (index: number, patch: Partial<TableBuilderColumn>) => dispatch({ type: "columns", value: state.columns.map((column, i) => i === index ? { ...column, ...patch } : column) });
  const removeColumn = (index: number) => { if (state.columns.length > 1) dispatch({ type: "columns", value: state.columns.filter((_, i) => i !== index) }); };

  async function run(operation: () => Promise<void>, creation = false) {
    if (running.current) return;
    running.current = true;
    dispatch({ type: "start" });
    try { await operation(); } catch (error) {
      if (creation) dispatch({ type: "creationError", value: error instanceof Error ? error.message : "The table could not be created." });
      onError(error);
    } finally { running.current = false; dispatch({ type: "finish" }); }
  }
  const previewTable = () => run(async () => {
    if (!tableNameIsValid || !columnsAreValid) return;
    dispatch({ type: "preview", value: await tablePreview.mutateAsync(definition), revision: state.revision });
  });
  const createTable = () => run(async () => {
    if (!state.preview) return;
    const result = await tableCreation.mutateAsync(state.preview.confirmationToken);
    dispatch({ type: "created" });
    onSuccess(`${result.table} created and verified.`);
  }, true);
  const previewImport = () => run(async () => {
    if (!state.csv.trim()) return;
    dispatch({ type: "csvPreview", value: await csvPreviewMutation.mutateAsync(state.csv), revision: state.revision });
  });
  const importCSV = () => run(async () => {
    if (!state.csvPreview?.readyToImport) return;
    const result = await csvImport.mutateAsync(state.csv);
    dispatch({ type: "imported" });
    onSuccess(`Imported ${result.importedCount} HomeInventory records.`);
  });
  function readCSV(file: File) {
    const request = ++csvRead.current;
    void file.text().then((value) => { if (request === csvRead.current) dispatch({ type: "csv", value }); }).catch(onError);
  }
  return { ...state, types, guidance: guidanceQuery.data ?? null, guidanceError: guidanceQuery.error?.message ?? null,
    definition, tableNameIsValid, columnsAreValid, setTableName, setCsv, addColumn, updateColumn, removeColumn, previewTable, createTable, previewImport, importCSV, readCSV };
}
