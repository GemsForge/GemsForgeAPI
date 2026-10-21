import { useState, type ChangeEvent } from "react";
import { previewCsv, previewJson, type ImportColumn, type ImportPreview } from "./import";

export interface TableImportWorkflowProps<Row> {
  columns: readonly ImportColumn[];
  validateJson: (value: unknown, row: number) => Row;
  onConfirm: (rows: readonly Row[]) => void | Promise<void>;
  onCancel?: () => void;
}

export function TableImportWorkflow<Row>({
  columns,
  validateJson,
  onConfirm,
  onCancel,
}: TableImportWorkflowProps<Row>) {
  const [mode, setMode] = useState<"csv" | "json">("csv");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview<Row> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewInput = () => {
    setError(null);
    setPreview(mode === "csv" ? previewCsv<Row>(text, columns) : previewJson<Row>(text, validateJson));
  };
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setText(await file.text());
  };
  const confirm = async () => {
    if (!preview || preview.errors.length) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm(preview.rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed");
    } finally {
      setPending(false);
    }
  };
  return (
    <section aria-label="Import records">
      <div role="tablist" aria-label="Import format">
        <button type="button" role="tab" aria-selected={mode === "csv"} onClick={() => setMode("csv")}>
          CSV
        </button>
        <button type="button" role="tab" aria-selected={mode === "json"} onClick={() => setMode("json")}>
          JSON
        </button>
      </div>
      <label>
        Paste {mode.toUpperCase()}
        <textarea
          aria-label={`Paste ${mode.toUpperCase()}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <label>
        Choose file
        <input type="file" accept={mode === "csv" ? ".csv,text/csv" : ".json,application/json"} onChange={handleFile} />
      </label>
      <button type="button" onClick={previewInput} disabled={!text}>
        Preview
      </button>
      {preview && (
        <div aria-label="Import preview">
          <p>{preview.rows.length} records ready</p>
          {preview.errors.map((item, index) => (
            <p role="alert" key={`${item.row}-${index}`}>
              Row {item.row}: {item.message}
            </p>
          ))}
          <button type="button" onClick={confirm} disabled={pending || preview.errors.length > 0}>
            Confirm import
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={onCancel} disabled={pending}>
        Cancel
      </button>
    </section>
  );
}
