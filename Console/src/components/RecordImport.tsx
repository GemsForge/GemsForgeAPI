import { useState, type ChangeEvent } from "react";
import { GemButton } from "@gemsforge/ui";
import { GemTextArea } from "@gemsforge/ui";
import type { SchemaPageTable } from "../types";
import { parseCsv, parseJson } from "../table-kit/import";
import { useCommitTableCSVImportMutation, usePreviewTableCSVImportMutation } from "../data/workflowQueries";

type Row = Record<string, unknown>;

/** Describe the feature-owned schema used by both import entry points. */
export interface RecordImportConfig {
  /** Human-readable resource name shown in the import workflow. */
  label: string;
  /** Columns accepted by the imported rows. */
  expectedColumns: readonly string[];
}

function parseCSV(input: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"' && value === "") quoted = true;
    else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (character !== "\r") value += character;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted value.");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  const [headers, ...data] = rows;
  if (!headers?.length) throw new Error("CSV must include a header row.");
  return data
    .filter((values) => values.some(Boolean))
    .map((values, index) => {
      if (values.length !== headers.length) throw new Error(`CSV row ${index + 2} has the wrong number of columns.`);
      return Object.fromEntries(headers.map((header, column) => [header.trim(), values[column].trim()]));
    });
}

export function RecordImport({
  label,
  expectedColumns,
  onPublish,
  open,
  onOpenChange,
  showTrigger = true,
  mode = "both",
  schemaTable,
}: RecordImportConfig & {
  onPublish?: (rows: Row[]) => Promise<void>;
  /** Optionally control the import utility from the shared Table Kit header. */
  open?: boolean;
  /** Notify the owning view when the import utility opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Hide the legacy inline trigger when the compact header owns the action. */
  showTrigger?: boolean;
  /** Limit the workflow to file selection, pasted data, or retain both inputs. */
  mode?: "both" | "file" | "paste";
  /** Use the existing file/paste shell with live schema mapping and server validation. */
  schemaTable?: SchemaPageTable;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setOpen = (nextOpen: boolean) => {
    setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  if (schemaTable) {
    return <SchemaTableRecordImport table={schemaTable} mode={mode} onClose={() => setOpen(false)} />;
  }
  function parse() {
    setError(null);
    try {
      const parsedRows = text.trim().startsWith("[") ? (JSON.parse(text) as Row[]) : parseCSV(text);
      const expected = new Set(expectedColumns);
      for (const [index, row] of parsedRows.entries()) {
        const keys = Object.keys(row);
        const missing = expectedColumns.filter((column) => !(column in row));
        const unknown = keys.filter((key) => !expected.has(key));
        if (missing.length || unknown.length)
          throw new Error(
            `Row ${index + 1} columns invalid. Missing: ${missing.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"}.`,
          );
      }
      setRows(parsedRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse the import.");
    }
  }
  return (
    <>
      {showTrigger && (
        <button type="button" onClick={() => setOpen(!isOpen)}>
          {isOpen ? "Close import" : `Import ${label}`}
        </button>
      )}
      {isOpen && (
        <section className="record-form">
          <div className="detail-heading">
            <h3>Import {label}</h3>
            <GemButton type="button" onClick={parse}>
              Preview import
            </GemButton>
          </div>
          <p className="muted">Paste a CSV with a header row or a JSON array using the table column names.</p>
          {mode !== "paste" && (
            <label>
              Choose CSV or JSON file
              <input
                type="file"
                accept=".csv,.json,application/json,text/csv"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) setText(await file.text());
                }}
              />
            </label>
          )}
          {mode !== "file" && (
            <GemTextArea
              aria-label={`${label} CSV or JSON`}
              rows={7}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
          {error && <p role="alert">{error}</p>}
          {rows && (
            <>
              <p>{rows.length} records ready to review.</p>
              <GemButton
                type="button"
                disabled={busy || rows.length === 0}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    if (!onPublish) throw new Error("This import has no record destination.");
                    await onPublish(rows);
                    setText("");
                    setRows(null);
                    setOpen(false);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not publish the import.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Publishing…" : "Publish records"}
              </GemButton>
            </>
          )}
        </section>
      )}
    </>
  );
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function normalizeInput(text: string): { headers: string[]; csv: string } {
  if (text.trim().startsWith("[")) {
    const rows = parseJson(text) as Record<string, unknown>[];
    if (!rows.length) throw new Error("JSON must contain at least one record.");
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    if (!headers.length) throw new Error("JSON records must include property names.");
    const cells = rows.map((row, index) => {
      const unsupported = Object.values(row).find(
        (value) => value !== null && !["string", "number", "boolean"].includes(typeof value),
      );
      if (unsupported !== undefined) throw new Error(`JSON record ${index + 1} values must be scalar.`);
      return headers.map((header) => (row[header] === null || row[header] === undefined ? "" : String(row[header])));
    });
    return { headers, csv: [headers, ...cells].map((row) => row.map(csvCell).join(",")).join("\n") };
  }
  const parsed = parseCsv(text);
  const headers = parsed[0] ?? [];
  if (headers.length === 0 || parsed.length < 2) throw new Error("CSV must include a header and at least one record.");
  return { headers, csv: text };
}

function SchemaTableRecordImport({
  table,
  mode,
  onClose,
}: {
  table: SchemaPageTable;
  mode: "both" | "file" | "paste";
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [normalized, setNormalized] = useState<{ headers: string[]; csv: string } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const previewMutation = usePreviewTableCSVImportMutation();
  const commitMutation = useCommitTableCSVImportMutation();
  const preview = previewMutation.data;
  const busy = previewMutation.isPending || commitMutation.isPending;
  const properties = table.columns.filter((column) => {
    if (column.name === "HubID") return false;
    return !column.primaryKey;
  });
  const setInput = (value: string) => {
    setText(value);
    setNormalized(null);
    setMapping({});
    setError(null);
    previewMutation.reset();
    commitMutation.reset();
  };
  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      setError("Choose a CSV or JSON file no larger than 1 MB.");
      return;
    }
    setInput(await file.text());
  };
  const prepare = () => {
    try {
      const parsed = normalizeInput(text);
      setNormalized(parsed);
      const suggested: Record<string, string> = {};
      for (const header of parsed.headers) {
        const column = properties.find((candidate) => candidate.name.toLowerCase() === header.trim().toLowerCase());
        if (column) suggested[header] = column.name;
      }
      setMapping(suggested);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read the import data.");
    }
  };
  const previewImport = async () => {
    if (!normalized) return;
    try {
      setError(null);
      await previewMutation.mutateAsync({ table: table.name, csv: normalized.csv, mapping });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The import could not be validated.");
    }
  };
  const confirmImport = async () => {
    if (!preview?.confirmationToken) return;
    try {
      setError(null);
      await commitMutation.mutateAsync(preview.confirmationToken);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The import could not be saved.");
    }
  };

  return (
    <section className="record-form" aria-label={`Import records into ${table.name}`} aria-busy={busy}>
      {mode !== "paste" ? (
        <label htmlFor={`${table.name}-schema-import-file`}>
          Choose CSV or JSON file
          <input
            id={`${table.name}-schema-import-file`}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            disabled={busy}
            onChange={(event) => void readFile(event)}
          />
        </label>
      ) : null}
      {mode !== "file" ? (
        <label htmlFor={`${table.name}-schema-import-paste`}>
          Paste CSV or JSON
          <GemTextArea
            id={`${table.name}-schema-import-paste`}
            aria-label={`${table.name} CSV or JSON`}
            rows={7}
            value={text}
            disabled={busy}
            onChange={(event) => setInput(event.target.value)}
          />
        </label>
      ) : null}
      {normalized ? (
        <fieldset>
          <legend>Map import fields to {table.name}</legend>
          {normalized.headers.map((header, index) => (
            <label key={`${header}-${index}`}>
              {header || `Column ${index + 1}`}
              <select
                className="create-form-control"
                value={mapping[header] ?? ""}
                disabled={busy}
                onChange={(event) => {
                  setMapping((current) => ({ ...current, [header]: event.target.value }));
                  previewMutation.reset();
                  commitMutation.reset();
                }}
              >
                <option value="">Skip this field</option>
                {properties
                  .filter((column) => !Object.values(mapping).includes(column.name) || mapping[header] === column.name)
                  .map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.name} · {column.dataType}
                    </option>
                  ))}
              </select>
            </label>
          ))}
          <GemButton type="button" disabled={busy} onClick={() => void previewImport()}>
            Preview and validate
          </GemButton>
        </fieldset>
      ) : text ? (
        <GemButton type="button" disabled={busy} onClick={prepare}>
          Map fields
        </GemButton>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {preview ? (
        <div aria-label="Import validation results">
          <p>
            {preview.table}: {preview.rows.length} records ·{" "}
            {preview.readyToImport ? "ready to import" : "fix the listed errors"}
          </p>
          {preview.rows.map((row) => (
            <p key={row.rowNumber}>
              Record {row.rowNumber}: {row.errors.length ? row.errors.join(" ") : "Valid"}
            </p>
          ))}
          {commitMutation.isSuccess ? (
            <>
              <p role="status">
                Imported {commitMutation.data.importedCount} records into {table.name}.
              </p>
              <GemButton type="button" onClick={onClose}>
                Done
              </GemButton>
            </>
          ) : (
            <GemButton
              type="button"
              disabled={!preview.readyToImport || !preview.confirmationToken || busy}
              onClick={() => void confirmImport()}
            >
              {busy ? "Saving…" : "Confirm and import"}
            </GemButton>
          )}
        </div>
      ) : null}
    </section>
  );
}
