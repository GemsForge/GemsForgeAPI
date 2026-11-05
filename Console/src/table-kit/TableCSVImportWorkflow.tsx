import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { parseCsv } from "./import";
import type { TableNewRecordUtilityOption } from "./types";
import { GemButton } from "@gemsforge/ui";
import {
  useCommitTableCSVImportMutation,
  useImportableSQLTablesQuery,
  usePreviewTableCSVImportMutation,
} from "../data/workflowQueries";

/** @deprecated Schema-backed collections use the shared RecordImport file/paste flow. */
// TODO: Remove this duplicate CSV workflow after any remaining callers migrate.
export function createTableCSVImportOption(tableName?: string): TableNewRecordUtilityOption {
  return {
    id: "table-csv-import",
    label: "Import CSV",
    description: "Choose a SQL table, map CSV headers, preview, then confirm.",
    render: ({ close }) => <TableCSVImportWorkflow initialTableName={tableName} onComplete={close} onCancel={close} />,
  };
}

/** Add the importer to consumer options once, preserving the original array when already present. */
export function ensureTableCSVImportOption(
  options: readonly TableNewRecordUtilityOption[],
): readonly TableNewRecordUtilityOption[] {
  return options.some((option) => option.id === "table-csv-import")
    ? options
    : [...options, createTableCSVImportOption()];
}

export function TableCSVImportWorkflow({
  onComplete,
  onCancel,
  initialTableName,
}: {
  onComplete: () => void;
  onCancel: () => void;
  initialTableName?: string;
}) {
  const tables = useImportableSQLTablesQuery();
  const previewMutation = usePreviewTableCSVImportMutation();
  const commitMutation = useCommitTableCSVImportMutation();
  const [tableName, setTableName] = useState(initialTableName ?? "");
  const [text, setText] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [csvError, setCsvError] = useState<string | null>(null);
  const selectedTable = tables.data?.tables.find((table) => table.name === tableName);
  const availableColumns = useMemo(
    () => (selectedTable?.columns ?? []).filter((column) => column.name !== "HubID"),
    [selectedTable],
  );
  const parsedHeaders = useMemo(() => {
    if (!text) return [];
    try {
      return parseCsv(text)[0] ?? [];
    } catch {
      return [];
    }
  }, [text]);
  useEffect(() => {
    if (!parsedHeaders.length || !availableColumns.length) return;
    setMapping((current) => {
      if (Object.keys(current).length > 0) return current;
      const suggested: Record<string, string> = {};
      const used = new Set<string>();
      for (const header of parsedHeaders) {
        const candidate = availableColumns.find(
          (column) => !used.has(column.name) && column.name.toLocaleLowerCase() === header.trim().toLocaleLowerCase(),
        );
        if (candidate) {
          suggested[header] = candidate.name;
          used.add(candidate.name);
        }
      }
      return suggested;
    });
  }, [availableColumns, parsedHeaders]);
  const preview = previewMutation.data;
  const busy = previewMutation.isPending || commitMutation.isPending;
  const setInput = (value: string) => {
    setText(value);
    setCsvError(null);
    previewMutation.reset();
    commitMutation.reset();
    setMapping({});
  };
  const setTable = (value: string) => {
    setTableName(value);
    setMapping({});
    previewMutation.reset();
    commitMutation.reset();
  };
  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      setCsvError("Choose a CSV file no larger than 1 MB.");
      return;
    }
    setInput(await file.text());
  };
  const mappingOptions = (header: string) => {
    const used = new Set(
      Object.entries(mapping)
        .filter(([key]) => key !== header)
        .map(([, value]) => value),
    );
    return availableColumns.filter((column) => !used.has(column.name) || mapping[header] === column.name);
  };

  return (
    <section className="table-csv-import" aria-label="Import CSV into SQL table" aria-busy={busy}>
      {tables.isPending && <p role="status">Loading importable tables…</p>}
      {tables.isError && <p role="alert">{tables.error.message}</p>}
      {tables.isSuccess && tables.data.tables.length === 0 && (
        <p role="status">No live tables are available for import.</p>
      )}
      {tables.data?.tables.length ? (
        <label className="table-csv-import-field">
          Target table
          <select
            className="create-form-control"
            value={tableName}
            disabled={busy}
            onChange={(event) => setTable(event.target.value)}
          >
            <option value="">Choose a table</option>
            {tables.data.tables.map((table) => (
              <option key={table.name} value={table.name}>
                {table.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="table-csv-import-field">
        Paste CSV
        <textarea
          className="create-form-control"
          rows={5}
          value={text}
          disabled={busy}
          onChange={(event) => setInput(event.target.value)}
          placeholder={'Name,Quantity\n"Dining table",2'}
        />
      </label>
      <label className="table-csv-import-field">
        Choose CSV file
        <input type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => void readFile(event)} />
      </label>
      {text && parsedHeaders.length === 0 && <p role="status">Add a valid CSV header row to map its columns.</p>}
      {selectedTable && parsedHeaders.length > 0 && (
        <fieldset className="table-csv-import-mapping">
          <legend>Map CSV headers to table properties</legend>
          {parsedHeaders.map((header, index) => {
            const column = mapping[header] ?? "";
            return (
              <label key={`${header}-${index}`} className="table-csv-import-field">
                <span>{header || `Column ${index + 1}`}</span>
                <select
                  className="create-form-control"
                  value={column}
                  disabled={busy}
                  onChange={(event) => {
                    setMapping((current) => ({ ...current, [header]: event.target.value }));
                    previewMutation.reset();
                    commitMutation.reset();
                  }}
                >
                  <option value="">Skip this column</option>
                  {mappingOptions(header).map((candidate) => (
                    <option key={candidate.name} value={candidate.name}>
                      {candidate.name} · {candidate.dataType}
                      {candidate.primaryKey ? " · primary key" : ""}
                      {candidate.nullable ? " · optional" : candidate.defaultValue ? " · defaulted" : " · required"}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </fieldset>
      )}
      {selectedTable && availableColumns.length > 0 && (
        <div className="table-csv-import-schema" aria-label="Target table requirements">
          {availableColumns
            .filter((column) => column.primaryKey || (!column.nullable && !column.defaultValue))
            .map((column) => (
              <span key={column.name}>
                {column.name}: {column.dataType}
                {column.primaryKey
                  ? " · primary key"
                  : column.defaultValue
                    ? " · defaulted"
                    : column.nullable
                      ? " · nullable"
                      : " · required"}
              </span>
            ))}
        </div>
      )}
      {csvError && <p role="alert">{csvError}</p>}
      {previewMutation.isError && <p role="alert">{previewMutation.error.message}</p>}
      {preview && (
        <div className="table-csv-import-preview" aria-label="CSV import preview">
          <p>
            {preview.table}: {preview.rows.length} rows ·{" "}
            {preview.readyToImport ? "ready to import" : "fix the listed errors before importing"}
          </p>
          <div className="table-csv-import-scroll" role="region" aria-label="Preview rows" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>CSV row</th>
                  {availableColumns
                    .filter((column) => Object.values(mapping).includes(column.name))
                    .map((column) => (
                      <th key={column.name}>{column.name}</th>
                    ))}
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <th scope="row">{row.rowNumber}</th>
                    {availableColumns
                      .filter((column) => Object.values(mapping).includes(column.name))
                      .map((column) => (
                        <td key={column.name}>{row.values[column.name] ?? ""}</td>
                      ))}
                    <td>{row.errors.length ? row.errors.join(" ") : "Ready"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!preview.readyToImport && <p role="alert">No records can be imported until every row is valid.</p>}
        </div>
      )}
      {commitMutation.isError && (
        <p role="alert">{commitMutation.error.message} Create a fresh preview before retrying.</p>
      )}
      {commitMutation.isSuccess && (
        <p role="status">
          Imported {commitMutation.data.importedCount} records into {commitMutation.data.table}.
        </p>
      )}
      <div className="table-csv-import-actions">
        <GemButton
          tone="secondary"
          disabled={busy || !selectedTable || !text || Object.values(mapping).every((value) => !value)}
          onPress={() => {
            try {
              const rows = parseCsv(text);
              if (new Set(rows[0] ?? []).size !== (rows[0] ?? []).length)
                throw new Error("CSV headers must be unique.");
              setCsvError(null);
              commitMutation.reset();
              previewMutation.mutate({
                table: tableName,
                csv: text,
                mapping: Object.fromEntries(Object.entries(mapping).filter(([, value]) => value)),
              });
            } catch (error) {
              setCsvError(error instanceof Error ? error.message : "Malformed CSV.");
            }
          }}
        >
          Preview import
        </GemButton>
        <GemButton
          disabled={
            busy ||
            commitMutation.isError ||
            commitMutation.isSuccess ||
            !preview?.readyToImport ||
            !preview.confirmationToken
          }
          onPress={() => {
            if (preview?.confirmationToken) commitMutation.mutate(preview.confirmationToken);
          }}
        >
          Confirm and import
        </GemButton>
        <GemButton
          tone="secondary"
          variant="quiet"
          disabled={busy}
          onPress={commitMutation.isSuccess ? onComplete : onCancel}
        >
          {commitMutation.isSuccess ? "Done" : "Cancel"}
        </GemButton>
      </div>
    </section>
  );
}
