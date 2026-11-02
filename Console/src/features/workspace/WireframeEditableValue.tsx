import { useState } from "react";
import { GemPrimitiveField } from "../../components/ui/GemPrimitiveField";

type EditableValueProps = {
  value: string;
  label?: string;
  kind?: "text" | "select" | "date" | "textarea";
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
  const primitive = kind === "select" ? "select" : kind === "date" ? "date" : "text";
  const commit = async (nextValue: string | number | boolean | null) => {
    const next = String(nextValue ?? "");
    setCurrentValue(next);
    if (onCommit && next !== value) await onCommit(next);
  };

  return (
    <GemPrimitiveField
      label={label}
      showLabel={false}
      primitive={primitive}
      value={currentValue}
      options={kind === "select" ? options.map((option) => ({ value: option, label: option })) : undefined}
      multiline={kind === "textarea"}
      width="long"
      onSave={commit}
    />
  );
}
