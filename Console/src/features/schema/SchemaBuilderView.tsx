import { useRef, useState } from "react";
import { useSchemaBuilder } from "../../hooks/useSchemaBuilder";
import { LiveSchemaView } from "./LiveSchemaView";
import { GemButton, GemField } from "../../components/ui";
import { Input, Select, TextArea } from "tamagui";

const schemaControlStyle = {
  width: "100%" as const,
  minHeight: "$5" as const,
  borderColor: "$gemPanelLight" as const,
  borderWidth: 1,
  borderRadius: "$gemControl" as const,
  backgroundColor: "$gemCanvas" as const,
  color: "$gemInk" as const,
};

interface SchemaBuilderViewProps {
  onError: (error: unknown) => void;
  onSuccess: (message: string) => void;
}

export function SchemaBuilderView({ onError, onSuccess }: SchemaBuilderViewProps) {
  const {
    types,
    tableName,
    setTableName,
    columns,
    preview,
    csv,
    setCsv,
    csvPreview,
    busy,
    creationError,
    guidance,
    guidanceError,
    tableNameIsValid,
    columnsAreValid,
    addColumn,
    updateColumn,
    removeColumn,
    previewTable,
    createTable,
    previewImport,
    importCSV,
    readCSV,
  } = useSchemaBuilder({ onError, onSuccess });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState("No file chosen");

  return (
    <>
      <div className="content-heading">
        <div>
          <p className="eyebrow">Milestone 2 · schema builder</p>
          <h2>Build & import</h2>
          <p className="muted">
            Describe a table, preview the generated schema, then explicitly approve its creation. CSV import follows the
            same preview-first workflow.
          </p>
        </div>
        <span className="record-count ready">Preview first</span>
      </div>

      <section className="schema-guidance database-panel">
        <div className="database-panel-heading">
          <div>
            <p className="eyebrow">API guidance · v{guidance?.version ?? "—"}</p>
            <h3>Build safely</h3>
          </div>
          <span className="life-mark database-icon">?</span>
        </div>
        {guidanceError ? (
          <p className="error-text">
            {guidanceError} The builder remains available, but type explanations are unavailable.
          </p>
        ) : null}
        {!guidance && !guidanceError ? <p className="muted">Loading schema rules…</p> : null}
        {guidance ? (
          <div className="schema-guidance-grid">
            <div className="schema-guidance-types">
              <strong>SQLite types</strong>
              {guidance.supportedTypes.map((type) => (
                <p className="guidance-item" key={type.value}>
                  <code>{type.label}</code> {type.description}
                </p>
              ))}
            </div>
            <div className="schema-guidance-rules">
              <strong>Rules & safety</strong>
              {guidance.rules.map((rule) => (
                <p className={`guidance-item guidance-${rule.severity}`} key={rule.key}>
                  <b>{rule.title}:</b> {rule.description}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <div className="database-layout schema-builder-layout">
        <section className="database-panel">
          <div className="database-panel-heading">
            <div>
              <p className="eyebrow">Schema builder</p>
              <h3>New SQLite table</h3>
            </div>
            <GemButton
              tone="secondary"
              className="life-mark database-icon"
              aria-label="Add property"
              onPress={addColumn}
            >
              ＋
            </GemButton>
          </div>
          <div className="database-field">
            <GemField
              label="Table name"
              value={tableName}
              onChange={(event) => setTableName(event.currentTarget.value)}
              placeholder="NewTable"
              {...schemaControlStyle}
            />
            {tableName && !tableNameIsValid ? (
              <small className="field-hint error-text">Use UpperCamelCase, such as NewTable.</small>
            ) : (
              <small className="field-hint">The API supplies the ID column automatically.</small>
            )}
          </div>
          <div className="builder-columns">
            <div className="builder-column-heading">
              <div>
                <strong>Column properties</strong>
                <small className="field-hint">Add at least one property, then use + for more.</small>
              </div>
            </div>
            {columns.map((column, index) => (
              <div className="builder-column" key={index}>
                <div>
                  <Input
                    className="schema-builder-control"
                    aria-label="Column property"
                    value={column.name}
                    onChange={(event) => updateColumn(index, { name: event.currentTarget.value })}
                    placeholder="Column property"
                    {...schemaControlStyle}
                  />
                  <small className="field-hint">Names must be unique and use letters, numbers, or underscores.</small>
                </div>
                <div>
                  <Select
                    value={column.dataType}
                    onValueChange={(value) => updateColumn(index, { dataType: value as (typeof types)[number] })}
                  >
                    <Select.Trigger className="schema-builder-control" aria-label="SQLite type" {...schemaControlStyle}>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Viewport minWidth={240}>
                        {(
                          guidance?.supportedTypes ?? types.map((value) => ({ value, label: value, description: "" }))
                        ).map((type) => (
                          <Select.Item key={type.value} value={type.value}>
                            <Select.ItemText>{type.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select>
                  {guidance ? (
                    <small className="field-hint">
                      {guidance.supportedTypes.find((type) => type.value === column.dataType)?.description}
                    </small>
                  ) : null}
                </div>
                <div>
                  <Input
                    className="schema-builder-control"
                    aria-label="Default value"
                    placeholder="Default"
                    value={column.defaultValue ?? ""}
                    onChange={(event) => updateColumn(index, { defaultValue: event.currentTarget.value || null })}
                    {...schemaControlStyle}
                  />
                  <small className="field-hint">Use a number, quoted text, NULL, or a CURRENT_* value.</small>
                </div>
                {columns.length > 1 ? (
                  <GemButton tone="secondary" aria-label="Remove property" onPress={() => removeColumn(index)}>
                    ×
                  </GemButton>
                ) : (
                  <span className="field-hint">Required property</span>
                )}
              </div>
            ))}
          </div>
          <GemButton disabled={busy || !tableNameIsValid || !columnsAreValid} onPress={() => void previewTable()}>
            {busy ? "Working…" : "Preview table"}
          </GemButton>
          {preview ? (
            <div className="builder-preview">
              <h4>Ready for approval</h4>
              <p className="muted">
                {preview.definition.tableName} · {preview.definition.columns.length} columns
              </p>
              {preview.warnings.map((warning) => (
                <p key={warning}>• {warning}</p>
              ))}
              <GemButton disabled={busy} onPress={() => void createTable()}>
                Create table with backup
              </GemButton>
              {creationError ? (
                <div className="builder-error">
                  <h4>Table was not created</h4>
                  <p>{creationError}</p>
                  {creationError.toLowerCase().includes("already exists") ? (
                    <p>Choose a different table name, then preview it again.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="database-panel">
          <div className="database-panel-heading">
            <div>
              <p className="eyebrow">HomeInventory</p>
              <h3>CSV import</h3>
            </div>
            <span className="record-count">Preview only</span>
          </div>
          <div className="database-field">
            <span>Choose CSV file</span>
            <div className="file-input-control">
              <GemButton tone="secondary" onPress={() => fileInputRef.current?.click()}>
                Choose file
              </GemButton>
              <span className="file-input-name" aria-live="polite">
                {selectedFileName}
              </span>
            </div>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setSelectedFileName(file.name);
                  readCSV(file);
                }
              }}
            />
          </div>
          <div className="database-field">
            <label htmlFor="schema-csv">Or paste CSV</label>
            <TextArea
              id="schema-csv"
              rows={9}
              value={csv}
              onChange={(event) => setCsv(event.currentTarget.value)}
              placeholder="ItemName,Quantity\nDesk lamp,1"
              {...schemaControlStyle}
            />
          </div>
          <div className="button-row">
            <GemButton tone="secondary" disabled={busy || !csv.trim()} onPress={() => void previewImport()}>
              Preview CSV
            </GemButton>
            <GemButton disabled={busy || !csvPreview?.readyToImport} onPress={() => void importCSV()}>
              Import approved rows
            </GemButton>
          </div>
          {csvPreview ? (
            <div className="builder-preview">
              <h4>{csvPreview.readyToImport ? "CSV is ready" : "CSV needs attention"}</h4>
              <p>
                {csvPreview.validRows.length} valid · {csvPreview.invalidRows.length} invalid
              </p>
              {csvPreview.invalidRows.map((row) => (
                <p className="error-text" key={row.rowNumber}>
                  Row {row.rowNumber}: {row.errors.join(" ")}
                </p>
              ))}
              {csvPreview.warnings.map((warning) => (
                <p key={warning}>• {warning}</p>
              ))}
            </div>
          ) : null}
        </section>
      </div>
      <LiveSchemaView onError={onError} />
    </>
  );
}
