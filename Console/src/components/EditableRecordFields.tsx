import { useId, type ChangeEvent, type ReactNode } from "react";
import { Form } from "tamagui";
import { GCheckboxField, GDate, GemTextField, GSelectField } from "./ui";
import type { GemTextFieldWidth } from "./ui/GemTextField";
import { useRecordEditor } from "../hooks/useRecordEditor";

export type EditableValue = string | number | boolean | null | undefined;
export type RecordInputType = "text" | "date" | "email" | "url" | "tel" | "number" | "boolean" | "select" | "longText";

export interface EditableRecordField {
  label: string;
  value: EditableValue;
  onSave?: (value: EditableValue) => Promise<void>;
  inputType?: RecordInputType;
  required?: boolean;
  nullable?: boolean;
  options?: Array<{ label: string; value: string }>;
  step?: string;
  placeholder?: string;
  width?: GemTextFieldWidth;
  displayValue?: ReactNode;
  readOnlyReason?: string;
  className?: string;
}

export function formatRecordTimestamp(value?: string | null): string {
  if (!value) return "Not recorded";
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.valueOf()) ? value : timestamp.toLocaleString();
}

/** Formats a date-only value without applying a timezone conversion. */
export function formatRecordDate(value?: string | null): string {
  const normalized = normalizeDateInput(value);
  if (!normalized) return "Not recorded";
  const [year, month, day] = normalized.split("-").map(Number);
  const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1];
  return `${String(day).padStart(2, "0")}${monthName}${year}`;
}

export function formatRecordCurrency(value?: number | null): string {
  return value === null || value === undefined
    ? "Not recorded"
    : value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function formatRecordPercentage(value?: number | null): string {
  return value === null || value === undefined ? "Not recorded" : `${value}%`;
}

/** Shared field behavior with a resource-controlled semantic layout. */
export function EditableRecordFields({ fields, className }: { fields: EditableRecordField[]; className?: string }) {
  return (
    <dl className={className ? `record-fields ${className}` : "record-fields"}>
      {fields.map((field) => (
        <EditableField field={field} key={field.label} />
      ))}
    </dl>
  );
}

function EditableField({ field }: { field: EditableRecordField }) {
  const instanceID = useId();
  const value = field.value ?? null;
  const initialValue =
    value === null ? "" : field.inputType === "date" ? normalizeDateInput(String(value)) : String(value);
  const editor = useRecordEditor(initialValue, async (draft) => {
    if (!field.onSave) return;
    await field.onSave(parseValue(draft, field));
  });
  const id = `edit-${instanceID}-${field.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const labelID = `${id}-label`;
  const onTextChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    editor.setDraft(event.currentTarget.value);

  return (
    <div className={field.className}>
      <dt className="editable-record-label" id={labelID}>
        {!field.onSave || !editor.editing ? field.label : null}
        {field.onSave && !editor.editing && (
          <button
            type="button"
            className="field-edit-button"
            aria-label={`Edit ${field.label.toLowerCase()}`}
            onClick={editor.begin}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M13.7 3.3a2 2 0 0 1 2.8 2.8L7.2 15.4l-3.7 1 1-3.7 9.2-9.4Z" />
              <path d="m12.3 4.7 3 3" />
            </svg>
          </button>
        )}
      </dt>
      <dd>
        {!field.onSave || !editor.editing ? (
          <>
            {field.inputType === "boolean" ? (
              <input
                type="checkbox"
                className="field-checkbox field-checkbox-display"
                checked={String(value).toLowerCase() === "true"}
                disabled
                aria-label={`${field.label}: ${String(value).toLowerCase() === "true" ? "checked" : "unchecked"}`}
                readOnly
              />
            ) : (
              (field.displayValue ?? presentValue(value))
            )}
            {field.readOnlyReason && <small className="field-readonly-reason">{field.readOnlyReason}</small>}
          </>
        ) : (
          <Form className="edit-form editable-field-form" onSubmit={() => void editor.save()}>
            {field.inputType === "date" ? (
              <GDate
                label={field.label}
                value={editor.draft}
                onChange={editor.setDraft}
                required={field.required}
                width={field.width ?? "long"}
                error={editor.error ?? undefined}
              />
            ) : field.inputType === "select" ? (
              <GSelectField
                label={field.label}
                value={editor.draft}
                options={(field.options ?? []).concat(field.nullable ? [{ value: "", label: "—" }] : [])}
                onChange={editor.setDraft}
                required={field.required}
                width={field.width ?? "long"}
                error={editor.error ?? undefined}
              />
            ) : field.inputType === "boolean" ? (
              <GCheckboxField
                label={field.label}
                value={editor.draft === "true"}
                onChange={(checked) => editor.setDraft(String(checked))}
                required={field.required}
                width={field.width ?? "long"}
                error={editor.error ?? undefined}
              />
            ) : (
              <GemTextField
                label={field.label}
                value={editor.draft}
                onChange={onTextChange}
                onBlur={() => undefined}
                type={field.inputType === "longText" ? undefined : (field.inputType ?? "text")}
                step={field.step}
                placeholder={field.placeholder}
                multiline={field.inputType === "longText"}
                width={field.width ?? "long"}
                required={field.required}
                error={editor.error ?? undefined}
              />
            )}
            {field.nullable && field.inputType !== "boolean" && field.inputType !== "select" && (
              <button type="button" className="text-button" onClick={() => editor.setDraft("")}>
                Clear value
              </button>
            )}
            <div className="button-row">
              <button type="submit" disabled={editor.saving || !editor.dirty}>
                {editor.saving ? "Saving…" : `Save ${field.label.toLowerCase()}`}
              </button>
              <button type="button" className="secondary-button" disabled={editor.saving} onClick={editor.cancel}>
                Cancel
              </button>
            </div>
          </Form>
        )}
      </dd>
    </div>
  );
}

function parseValue(value: string, field: EditableRecordField): EditableValue {
  if (field.inputType === "boolean") return value === "true";
  if (value === "" && field.nullable) return null;
  if (field.inputType === "number") return Number(value);
  return value;
}

function normalizeDateInput(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const legacy = /^(\d{2})([A-Za-z]{3})(\d{4})$/.exec(value);
  if (legacy) {
    const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(
      legacy[2],
    );
    if (month >= 0) return `${legacy[3]}-${String(month + 1).padStart(2, "0")}-${legacy[1]}`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "" : parsed.toISOString().slice(0, 10);
}

function presentValue(value: EditableValue): string {
  if (value == null || value === "") return "—";
  return String(value);
}
