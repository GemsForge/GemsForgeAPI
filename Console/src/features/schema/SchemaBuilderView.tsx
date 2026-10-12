import { useEffect, useState } from "react";
import { api } from "../../api";
import type { HomeInventoryCSVPreview, SchemaBuilderGuidance, TableBuilderColumn, TableBuilderRequest, UserTablePreview } from "../../types";
import { LiveSchemaView } from "./LiveSchemaView";

interface SchemaBuilderViewProps {
  onError: (error: unknown) => void;
  onSuccess: (message: string) => void;
}

const types = ["TEXT", "INTEGER", "REAL", "NUMERIC", "BLOB", "ANY"] as const;

const initialColumns: TableBuilderColumn[] = [
  { name: "InventoryID", dataType: "TEXT", nullable: false, defaultValue: null, primaryKey: true, unique: true },
  { name: "ItemName", dataType: "TEXT", nullable: false, defaultValue: null, primaryKey: false, unique: false },
  { name: "Quantity", dataType: "INTEGER", nullable: false, defaultValue: "1", primaryKey: false, unique: false },
];

export function SchemaBuilderView({ onError, onSuccess }: SchemaBuilderViewProps) {
  const [tableName, setTableName] = useState("HomeInventoryDraft");
  const [columns, setColumns] = useState(initialColumns);
  const [preview, setPreview] = useState<UserTablePreview | null>(null);
  const [csv, setCsv] = useState("");
  const [csvPreview, setCsvPreview] = useState<HomeInventoryCSVPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [guidance, setGuidance] = useState<SchemaBuilderGuidance | null>(null);
  const [guidanceError, setGuidanceError] = useState<string | null>(null);

  useEffect(() => {
    void api.getSchemaBuilderGuidance()
      .then(setGuidance)
      .catch((error: unknown) => setGuidanceError(error instanceof Error ? error.message : "Schema guidance could not be loaded."));
  }, []);

  const definition: TableBuilderRequest = { tableName, columns };

  function updateColumn(index: number, patch: Partial<TableBuilderColumn>) {
    setColumns((current) => current.map((column, columnIndex) => columnIndex === index ? { ...column, ...patch } : column));
  }

  async function previewTable() {
    setBusy(true);
    try { setPreview(await api.previewUserTable(definition)); } catch (error) { onError(error); } finally { setBusy(false); }
  }

  async function createTable() {
    if (!preview) return;
    setBusy(true);
    try { const result = await api.createUserTable(preview.confirmationToken); onSuccess(`${result.table} created and verified.`); setPreview(null); } catch (error) { onError(error); } finally { setBusy(false); }
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

  return <>
    <div className="content-heading"><div><p className="eyebrow">Milestone 2 · schema builder</p><h2>Build & import</h2><p className="muted">Describe a table, preview the generated schema, then explicitly approve its creation. CSV import follows the same preview-first workflow.</p></div><span className="record-count ready">Preview first</span></div>

    <section className="schema-guidance database-panel">
      <div className="database-panel-heading"><div><p className="eyebrow">API guidance · v{guidance?.version ?? "—"}</p><h3>Build safely</h3></div><span className="life-mark database-icon">?</span></div>
      {guidanceError ? <p className="error-text">{guidanceError} The builder remains available, but type explanations are unavailable.</p> : null}
      {!guidance && !guidanceError ? <p className="muted">Loading schema rules…</p> : null}
      {guidance ? <div className="schema-guidance-grid"><div><strong>SQLite types</strong>{guidance.supportedTypes.map((type) => <p className="guidance-item" key={type.value}><code>{type.label}</code> {type.description}</p>)}</div><div><strong>Rules & safety</strong>{guidance.rules.map((rule) => <p className={`guidance-item guidance-${rule.severity}`} key={rule.key}><b>{rule.title}:</b> {rule.description}</p>)}</div></div> : null}
    </section>

    <div className="database-layout">
      <section className="database-panel">
        <div className="database-panel-heading"><div><p className="eyebrow">Schema builder</p><h3>New SQLite table</h3></div><span className="life-mark database-icon">＋</span></div>
        <label className="database-field">Table name<input value={tableName} onChange={(event) => setTableName(event.target.value)} /></label>
        <div className="builder-columns"><div className="builder-column-heading"><strong>Columns</strong><button className="secondary-button" onClick={() => setColumns([...columns, { name: "NewColumn", dataType: "TEXT", nullable: true, defaultValue: null, primaryKey: false, unique: false }])}>Add column</button></div>{columns.map((column, index) => <div className="builder-column" key={`${index}-${column.name}`}><div><input aria-label="Column name" value={column.name} onChange={(event) => updateColumn(index, { name: event.target.value })} /><small className="field-hint">Names must be unique and use letters, numbers, or underscores.</small></div><div><select aria-label="SQLite type" value={column.dataType} onChange={(event) => updateColumn(index, { dataType: event.target.value as TableBuilderColumn["dataType"] })}>{(guidance?.supportedTypes ?? types.map((value) => ({ value, label: value, description: "" }))).map((type) => <option key={type.value}>{type.value}</option>)}</select>{guidance ? <small className="field-hint">{guidance.supportedTypes.find((type) => type.value === column.dataType)?.description}</small> : null}</div><label className="inline-check"><input type="checkbox" checked={!column.nullable} disabled={column.primaryKey} onChange={(event) => updateColumn(index, { nullable: !event.target.checked })} /> required</label><label className="inline-check"><input type="checkbox" checked={column.primaryKey} onChange={(event) => updateColumn(index, { primaryKey: event.target.checked, unique: event.target.checked, nullable: false })} /> key</label><div><input aria-label="Default value" placeholder="Default" value={column.defaultValue ?? ""} onChange={(event) => updateColumn(index, { defaultValue: event.target.value || null })} /><small className="field-hint">Use a number, quoted text, NULL, or a CURRENT_* value.</small></div>{columns.length > 1 ? <button className="icon-button" onClick={() => setColumns(columns.filter((_, columnIndex) => columnIndex !== index))}>×</button> : null}</div>)}</div>
        <button className="primary-button" disabled={busy || !tableName.trim()} onClick={() => void previewTable()}>{busy ? "Working…" : "Preview table"}</button>
        {preview ? <div className="builder-preview"><h4>Ready for approval</h4><p className="muted">{preview.definition.tableName} · {preview.definition.columns.length} columns</p>{preview.warnings.map((warning) => <p key={warning}>• {warning}</p>)}<button className="primary-button" disabled={busy} onClick={() => void createTable()}>Create table with backup</button></div> : null}
      </section>

      <section className="database-panel"><div className="database-panel-heading"><div><p className="eyebrow">HomeInventory</p><h3>CSV import</h3></div><span className="record-count">Preview only</span></div><label className="database-field">Choose CSV file<input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) readCSV(file); }} /></label><label className="database-field">Or paste CSV<textarea rows={9} value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="InventoryID,ItemName,Quantity\nINV-0001,Desk lamp,1" /></label><div className="button-row"><button className="secondary-button" disabled={busy || !csv.trim()} onClick={() => void previewImport()}>Preview CSV</button><button className="primary-button" disabled={busy || !csvPreview?.readyToImport} onClick={() => void importCSV()}>Import approved rows</button></div>{csvPreview ? <div className="builder-preview"><h4>{csvPreview.readyToImport ? "CSV is ready" : "CSV needs attention"}</h4><p>{csvPreview.validRows.length} valid · {csvPreview.invalidRows.length} invalid</p>{csvPreview.invalidRows.map((row) => <p className="error-text" key={row.rowNumber}>Row {row.rowNumber}: {row.errors.join(" ")}</p>)}{csvPreview.warnings.map((warning) => <p key={warning}>• {warning}</p>)}</div> : null}</section>
    </div>
    <LiveSchemaView onError={onError} />
  </>;
}
