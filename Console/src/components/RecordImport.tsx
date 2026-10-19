import { useState } from "react";

type Row = Record<string, unknown>;

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
        const [header, ...lines] = text.trim().split(/\r?\n/);
        const headers = header.split(",").map((v) => v.trim());
        setRows(lines.filter(Boolean).map((line) => Object.fromEntries(line.split(",").map((v, i) => [headers[i], v.trim()]))));
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
