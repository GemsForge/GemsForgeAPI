import { useState } from "react";

type Row = Record<string, unknown>;

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
}: {
  label: string;
  expectedColumns: string[];
  onPublish: (rows: Row[]) => Promise<void>;
  /** Optionally control the import utility from the shared Table Kit header. */
  open?: boolean;
  /** Notify the owning view when the import utility opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Hide the legacy inline trigger when the compact header owns the action. */
  showTrigger?: boolean;
  /** Limit the workflow to file selection, clipboard data, or retain both inputs. */
  mode?: "both" | "file" | "clipboard";
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
  function parse() {
    setError(null);
    try {
      if (text.trim().startsWith("[")) setRows(JSON.parse(text));
      else {
        setRows(parseCSV(text));
      }
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
            <button type="button" onClick={parse}>
              Preview import
            </button>
          </div>
          <p className="muted">Paste a CSV with a header row or a JSON array using the table column names.</p>
          {mode !== "clipboard" && (
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
            <textarea
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
              <button
                type="button"
                disabled={busy || rows.length === 0}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
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
              </button>
            </>
          )}
        </section>
      )}
    </>
  );
}
