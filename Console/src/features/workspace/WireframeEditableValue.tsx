import { useState } from "react";
import { GemPrimitiveField } from "../../components/ui/GemPrimitiveField";

type EditableValueProps = {
  value: string;
  label?: string;
  kind?: "text" | "select" | "status" | "number" | "date" | "textarea";
  options?: string[];
  onCommit?: (value: string) => Promise<void>;
};

export function WireframeEditableValue({
  value,
  label = "Value",
  kind = "text",
  options = [],
  onCommit,
}: EditableValueProps) {
  const [currentValue, setCurrentValue] = useState(value);
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const primitive =
    kind === "select" || kind === "status" || kind === "number" ? kind : kind === "date" ? "date" : "text";
  const commit = async (nextValue: string | number | boolean | null) => {
    const next = String(nextValue ?? "");
    setCurrentValue(next);
    if (onCommit && next !== value) {
      setSaveError(undefined);
      try {
        await onCommit(next);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Could not save this property.");
      }
    }
  };

  return (
    <GemPrimitiveField
      label={label}
      showLabel={false}
      primitive={primitive}
      value={currentValue}
      editing={editing}
      displayValue={currentValue || "—"}
      onDisplayClick={() => {
        setSaveError(undefined);
        setEditing(true);
      }}
      options={
        kind === "select" || kind === "status" ? options.map((option) => ({ value: option, label: option })) : undefined
      }
      multiline={kind === "textarea"}
      width="long"
      wireframe
      error={saveError}
      onChange={(next) => {
        if (typeof next === "string") setCurrentValue(next);
        if (kind === "select" || kind === "status") setEditing(false);
      }}
      onSave={commit}
      onBlur={() => setEditing(false)}
    />
  );
}
