import { Form } from "tamagui";
import { useRecordEditor } from "../hooks/useRecordEditor";

/**
 * Renders the compact edit affordance for a scalar record property and swaps
 * it for an inline form while the property is being edited. The hook owns the
 * draft, dirty, saving, cancel, and error transitions; this component only
 * maps those transitions to the accessible console controls.
 */
export function PropertyEditor({
  label,
  initialValue,
  editLabel,
  saveLabel,
  required = false,
  onSave,
}: {
  label: string;
  initialValue: string;
  editLabel: string;
  saveLabel: string;
  required?: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const editor = useRecordEditor(initialValue, onSave);

  if (!editor.editing) {
    return (
      <button className="icon-button" type="button" aria-label={editLabel} title={editLabel} onClick={editor.begin}>
        <span aria-hidden="true">✎</span>
        <span>Edit</span>
      </button>
    );
  }

  return (
    <Form className="edit-form" onSubmit={() => void editor.save()}>
      <label>
        {label}
        <input
          value={editor.draft}
          onChange={(event) => editor.setDraft(event.target.value)}
          required={required}
          aria-invalid={Boolean(editor.error)}
        />
      </label>
      {editor.error && <p role="alert">{editor.error}</p>}
      <button type="submit" disabled={editor.saving || !editor.dirty}>
        {editor.saving ? "Saving…" : saveLabel}
      </button>
      <button type="button" onClick={editor.cancel} disabled={editor.saving}>
        Cancel
      </button>
    </Form>
  );
}
