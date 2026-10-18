import type { ReactNode } from "react";
import { useRecordEditor } from "../hooks/useRecordEditor";
import { RecordFields } from "./RecordFields";

export type EditableValue = string | number | boolean | null;
export type RecordInputType = "text" | "date" | "email" | "url" | "number" | "boolean" | "select" | "textarea";

export interface EditableRecordField {
  label: string;
  value: EditableValue;
  onSave?: (value: EditableValue) => Promise<void>;
  inputType?: RecordInputType;
  required?: boolean;
  nullable?: boolean;
  options?: Array<{ label: string; value: string }>;
  step?: string;
  displayValue?: ReactNode;
  readOnlyReason?: string;
  className?: string;
}

/** Shared field behavior with a resource-controlled semantic layout. */
export function EditableRecordFields({ fields, className }: { fields: EditableRecordField[]; className?: string }) {
  return (
    <RecordFields
      className={className}
      fields={fields.map((field) => ({
        label: field.label,
        className: field.className,
        value: <EditableField field={field} />,
      }))}
    />
  );
}

function EditableField({ field }: { field: EditableRecordField }) {
  const initialValue = field.value === null ? "" : String(field.value);
  const editor = useRecordEditor(initialValue, async (draft) => {
    if (!field.onSave) return;
    await field.onSave(parseValue(draft, field));
  });

  if (!field.onSave) {
    return (
      <>
        {field.displayValue ?? presentValue(field.value)}
        {field.readOnlyReason && <small className="field-readonly-reason">{field.readOnlyReason}</small>}
      </>
    );
  }

  if (!editor.editing) {
    return (
      <div className="editable-field-value">
        <span>{field.displayValue ?? presentValue(field.value)}</span>
        <button type="button" className="text-button field-edit-button" onClick={editor.begin}>
          Edit {field.label.toLowerCase()}
        </button>
      </div>
    );
  }

  const id = `edit-${field.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const common = {
    id,
    value: editor.draft,
    required: field.required,
    "aria-invalid": Boolean(editor.error),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      editor.setDraft(event.currentTarget.value),
  };

  return (
    <form
      className="edit-form editable-field-form"
      onSubmit={(event) => {
        event.preventDefault();
        void editor.save();
      }}
    >
      <label htmlFor={id}>{field.label}</label>
      {field.inputType === "textarea" ? (
        <textarea {...common} rows={3} />
      ) : field.inputType === "select" ? (
        <select {...common}>
          {field.nullable && <option value="">—</option>}
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.inputType === "boolean" ? (
        <input
          id={id}
          type="checkbox"
          checked={editor.draft === "true"}
          onChange={(event) => editor.setDraft(String(event.currentTarget.checked))}
        />
      ) : (
        <input type={field.inputType ?? "text"} step={field.step} {...common} />
      )}
      {field.nullable && field.inputType !== "boolean" && field.inputType !== "select" && (
        <button type="button" className="text-button" onClick={() => editor.setDraft("")}>
          Clear value
        </button>
      )}
      {editor.error && <p role="alert">{editor.error}</p>}
      <div className="button-row">
        <button type="submit" disabled={editor.saving || !editor.dirty}>
          {editor.saving ? "Saving…" : `Save ${field.label.toLowerCase()}`}
        </button>
        <button type="button" className="secondary-button" disabled={editor.saving} onClick={editor.cancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function parseValue(value: string, field: EditableRecordField): EditableValue {
  if (field.inputType === "boolean") return value === "true";
  if (value === "" && field.nullable) return null;
  if (field.inputType === "number") return Number(value);
  return value;
}

function presentValue(value: EditableValue): string {
  if (value === null || value === "") return "—";
  return String(value);
}
