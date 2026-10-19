import { useState } from "react";

type Row = Record<string, unknown>;

function parseCSV(input: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"' && value === "") quoted = true;
    else if (character === ",") { row.push(value); value = ""; }
    else if (character === "\n") { row.push(value); rows.push(row); row = []; value = ""; }
    else if (character !== "\r") value += character;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted value.");
  if (value || row.length) { row.push(value); rows.push(row); }
  const [headers, ...data] = rows;
  if (!headers?.length) throw new Error("CSV must include a header row.");
  return data.filter((values) => values.some(Boolean)).map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${index + 2} has the wrong number of columns.`);
    return Object.fromEntries(headers.map((header, column) => [header.trim(), values[column].trim()]));
  });
}

export function RecordImport({ label, onPublish }: { label: string; onPublish: (rows: Row[]) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  function parse() {
    setError(null);
    try {
      if (text.trim().startsWith("[")) setRows(JSON.parse(text));
      else {
        setRows(parseCSV(text));
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not parse the import."); }
  }
  return <>
    <button type="button" onClick={() => setOpen((value) => !value)}>{open ? "Close import" : `Import ${label}`}</button>
    {open && <section className="record-form">
      <h3>Import {label}</h3>
      <p className="muted">Paste a CSV with a header row or a JSON array using the table column names.</p>
      <label>Choose CSV or JSON file<input type="file" accept=".csv,.json,application/json,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setText(await file.text()); }} /></label>
      <textarea aria-label={`${label} CSV or JSON`} rows={7} value={text} onChange={(e) => setText(e.target.value)} />
      <button type="button" onClick={parse}>Preview import</button>
      {error && <p role="alert">{error}</p>}
      {rows && <>
        <p>{rows.length} records ready to review.</p>
        <button type="button" disabled={busy || rows.length === 0} onClick={async () => { setBusy(true); setError(null); try { await onPublish(rows); setText(""); setRows(null); setOpen(false); } catch (e) { setError(e instanceof Error ? e.message : "Could not publish the import."); } finally { setBusy(false); } }}>{busy ? "Publishing…" : "Publish records"}</button>
      </>}
    </section>}
  </>;
}
