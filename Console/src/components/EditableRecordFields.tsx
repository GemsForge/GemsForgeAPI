import { useId, type ChangeEvent, type ReactNode } from "react";
import { Form, Tooltip } from "tamagui";
import { GCheckboxField, GDate, GemButton, GemField, GSelectField } from "./ui";
import type { GemTextFieldWidth } from "./ui/GemTextField";
import { useRecordEditor } from "../hooks/useRecordEditor";

export type EditableValue = string | number | boolean | null | undefined;
export type RecordInputType = "text" | "date" | "email" | "url" | "tel" | "number" | "boolean" | "select" | "longText";

export interface EditableRecordField {
  label: string;
  value: EditableValue;
  /** Hides the display-mode label when the value occupies a title or other named slot. */
  hideLabel?: boolean;
  /** Explicitly declares whether this field may be edited in the current context. */
  editable?: boolean;
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

/** Renders one logical record field, switching its value region between display and inline edit modes. */
function EditableField({ field }: { field: EditableRecordField }) {
  const isEditable = field.editable ?? Boolean(field.onSave);
  const instanceID = useId();
  const value = field.value ?? null;
  const initialValue =
    value === null ? "" : field.inputType === "date" ? normalizeDateInput(String(value)) : String(value);
  const editor = useRecordEditor(initialValue, async (draft) => {
    if (!isEditable || !field.onSave) return;
    await field.onSave(parseValue(draft, field));
  });
  const id = `edit-${instanceID}-${field.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const labelID = `${id}-label`;
  const onTextChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    editor.setDraft(event.currentTarget.value);

  return (
      <div className={field.className} data-editing={editor.editing || undefined}>
        {!editor.editing && !field.hideLabel && field.inputType !== "select" && (
          <dt className="editable-record-label" id={labelID}>
            {field.label}
          </dt>
        )}
        <dd>
          {!isEditable || !field.onSave || !editor.editing ? (
            isEditable && field.onSave ? (
              field.inputType === "select" ? (
                <GSelectField
                  label={field.label}
                  value={String(value ?? "")}
                  options={field.options ?? []}
                  editing={false}
                  displayValue={field.displayValue ?? presentValue(value)}
                  onDisplayClick={editor.begin}
                />
              ) : <button
                  type="button"
                  className="editable-record-value-button"
                  aria-label={`${field.label}: ${presentValue(value)}`}
                  onClick={editor.begin}
                >
                  {field.inputType === "boolean" ? (
                    <span
                      className="field-checkbox field-checkbox-display"
                      role="img"
                      aria-label={String(value).toLowerCase() === "true" ? "checked" : "unchecked"}
                    />
                  ) : (
                    (field.displayValue ?? presentValue(value))
                  )}
                  {field.readOnlyReason && <small className="field-readonly-reason">{field.readOnlyReason}</small>}
                </button>
            ) : (
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
            )
          ) : (
            <Form className="edit-form editable-field-form" onSubmit={(event) => { event.preventDefault(); void editor.save(); }}>
                  <div className="editable-field-control-row">
                    {field.inputType === "date" ? (
                      <GDate
                        label={field.label}
                        value={editor.draft}
                        onChange={(next) => {
                          editor.setDraft(next);
                          void editor.save(next);
                        }}
                        required={field.required}
                        width={field.width ?? "medium"}
                        error={editor.error ?? undefined}
                      />
                    ) : field.inputType === "select" ? (
                      <GSelectField
                        label={field.label}
                        value={editor.draft}
                        options={(field.options ?? []).concat(field.nullable ? [{ value: "", label: "—" }] : [])}
                        onChange={(next) => {
                          editor.setDraft(next);
                          void editor.save(next);
                        }}
                        required={field.required}
                        width={field.width ?? "medium"}
                        error={editor.error ?? undefined}
                      />
                    ) : field.inputType === "boolean" ? (
                      <GCheckboxField
                        label={field.label}
                        value={editor.draft === "true"}
                        onChange={(checked) => {
                          const next = String(checked);
                          editor.setDraft(next);
                          void editor.save(next);
                        }}
                        required={field.required}
                        width={field.width ?? "medium"}
                        error={editor.error ?? undefined}
                      />
                    ) : (
                      <GemField
                        label={field.label}
                        value={editor.draft}
                        onChange={onTextChange}
                        type={field.inputType === "longText" ? undefined : (field.inputType ?? "text")}
                        step={field.step}
                        placeholder={field.placeholder}
                        multiline={field.inputType === "longText"}
                        width={field.width ?? "medium"}
                        required={field.required}
                        error={editor.error ?? undefined}
                        onBlur={() => void editor.save()}
                      />
                    )}
                    {field.nullable && field.inputType !== "boolean" && field.inputType !== "select" && (
                      <button type="button" className="text-button" onClick={() => editor.setDraft("")}>
                        Clear value
                      </button>
                    )}
                    <div className="button-row editable-field-actions">
                      <Tooltip placement="top" delay={300}>
                        <Tooltip.Trigger asChild>
                          <GemButton
                            tone="secondary"
                            type="button"
                            variant="quiet"
                            size="sm"
                            aria-label={`Cancel editing ${field.label.toLowerCase()}`}
                            disabled={editor.saving}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={editor.cancel}
                          >
                            <span aria-hidden="true">×</span>
                          </GemButton>
                        </Tooltip.Trigger>
                        <Tooltip.Content className="table-kit-tooltip">
                          <Tooltip.Arrow />
                          <span>Cancel editing</span>
                        </Tooltip.Content>
                      </Tooltip>
                    </div>
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
