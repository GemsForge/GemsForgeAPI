import { useRecordEditor } from "../hooks/useRecordEditor";

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
      <button type="button" onClick={editor.begin}>
        {editLabel}
      </button>
    );
  }

  return (
    <form
      className="edit-form"
      onSubmit={(event) => {
        event.preventDefault();
        void editor.save();
      }}
    >
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
    </form>
  );
}
