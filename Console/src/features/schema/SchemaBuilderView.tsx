import { useSchemaBuilder } from "../../hooks/useSchemaBuilder";
import { LiveSchemaView } from "./LiveSchemaView";

interface SchemaBuilderViewProps {
  onError: (error: unknown) => void;
  onSuccess: (message: string) => void;
}

export function SchemaBuilderView({ onError, onSuccess }: SchemaBuilderViewProps) {
  const { types, tableName, setTableName, columns, preview, csv, setCsv, csvPreview, busy, creationError, guidance, guidanceError, tableNameIsValid, columnsAreValid, addColumn, updateColumn, removeColumn, previewTable, createTable, previewImport, importCSV, readCSV } = useSchemaBuilder({ onError, onSuccess });

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
        <label className="database-field">Table name<input value={tableName} onChange={(event) => setTableName(event.target.value)} placeholder="NewTable" />{tableName && !tableNameIsValid ? <small className="field-hint error-text">Use UpperCamelCase, such as NewTable.</small> : <small className="field-hint">The API supplies the ID column automatically.</small>}</label>
        <div className="builder-columns"><div className="builder-column-heading"><div><strong>Column properties</strong><small className="field-hint">Add at least one property, then use + for more.</small></div><button className="secondary-button" onClick={addColumn}>＋ Add property</button></div>{columns.map((column, index) => <div className="builder-column" key={index}><div><input aria-label="Column property" value={column.name} onChange={(event) => updateColumn(index, { name: event.target.value })} placeholder="Column property" /><small className="field-hint">Names must be unique and use letters, numbers, or underscores.</small></div><div><select aria-label="SQLite type" value={column.dataType} onChange={(event) => updateColumn(index, { dataType: event.target.value as typeof types[number] })}>{(guidance?.supportedTypes ?? types.map((value) => ({ value, label: value, description: "" }))).map((type) => <option key={type.value}>{type.value}</option>)}</select>{guidance ? <small className="field-hint">{guidance.supportedTypes.find((type) => type.value === column.dataType)?.description}</small> : null}</div><div><input aria-label="Default value" placeholder="Default" value={column.defaultValue ?? ""} onChange={(event) => updateColumn(index, { defaultValue: event.target.value || null })} /><small className="field-hint">Use a number, quoted text, NULL, or a CURRENT_* value.</small></div>{columns.length > 1 ? <button className="icon-button" aria-label="Remove property" onClick={() => removeColumn(index)}>×</button> : <span className="field-hint">Required property</span>}</div>)}</div>
        <button className="primary-button" disabled={busy || !tableNameIsValid || !columnsAreValid} onClick={() => void previewTable()}>{busy ? "Working…" : "Preview table"}</button>
        {preview ? <div className="builder-preview"><h4>Ready for approval</h4><p className="muted">{preview.definition.tableName} · {preview.definition.columns.length} columns</p>{preview.warnings.map((warning) => <p key={warning}>• {warning}</p>)}<button className="primary-button" disabled={busy} onClick={() => void createTable()}>Create table with backup</button>{creationError ? <div className="builder-error"><h4>Table was not created</h4><p>{creationError}</p>{creationError.toLowerCase().includes("already exists") ? <p>Choose a different table name, then preview it again.</p> : null}</div> : null}</div> : null}
      </section>

      <section className="database-panel"><div className="database-panel-heading"><div><p className="eyebrow">HomeInventory</p><h3>CSV import</h3></div><span className="record-count">Preview only</span></div><label className="database-field">Choose CSV file<input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) readCSV(file); }} /></label><label className="database-field">Or paste CSV<textarea rows={9} value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="ItemName,Quantity\nDesk lamp,1" /></label><div className="button-row"><button className="secondary-button" disabled={busy || !csv.trim()} onClick={() => void previewImport()}>Preview CSV</button><button className="primary-button" disabled={busy || !csvPreview?.readyToImport} onClick={() => void importCSV()}>Import approved rows</button></div>{csvPreview ? <div className="builder-preview"><h4>{csvPreview.readyToImport ? "CSV is ready" : "CSV needs attention"}</h4><p>{csvPreview.validRows.length} valid · {csvPreview.invalidRows.length} invalid</p>{csvPreview.invalidRows.map((row) => <p className="error-text" key={row.rowNumber}>Row {row.rowNumber}: {row.errors.join(" ")}</p>)}{csvPreview.warnings.map((warning) => <p key={warning}>• {warning}</p>)}</div> : null}</section>
    </div>
    <LiveSchemaView onError={onError} />
  </>;
}
