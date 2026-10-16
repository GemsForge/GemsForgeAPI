import { useState } from "react";
import { presentError } from "../components/errorPresentation";

export function useRecordEditor(initialValue: string, onSave: (value: string) => Promise<void>) {
  const [editing, setEditing] = useState(false);
  const [baseline, setBaseline] = useState(initialValue);
  const [draft, setDraft] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function begin() {
    setBaseline(initialValue);
    setDraft(initialValue);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    if (saving) return;
    setBaseline(initialValue);
    setDraft(initialValue);
    setError(null);
    setEditing(false);
  }

  async function save() {
    if (draft === baseline) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (cause) {
      setError(presentError(cause).message);
    } finally {
      setSaving(false);
    }
  }

  return {
    editing,
    draft,
    setDraft,
    dirty: draft !== baseline,
    saving,
    error,
    begin,
    cancel,
    save,
  };
}
