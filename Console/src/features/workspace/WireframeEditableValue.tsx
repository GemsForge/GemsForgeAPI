import { useState } from "react";

type EditableValueProps = { value: string; kind?: "text" | "select" | "date" | "textarea"; options?: string[]; onCommit?: (value: string) => Promise<void> };

export function WireframeEditableValue({ value, kind = "text", options = [], onCommit }: EditableValueProps) {
  const [currentValue, setCurrentValue] = useState(value);
  const commit = () => { if (onCommit && currentValue !== value) void onCommit(currentValue); };
  if (kind === "select") return <select className="wireframe-editable-value" value={currentValue} onChange={(event) => { setCurrentValue(event.target.value); if (onCommit) void onCommit(event.target.value); }}>{options.map((option) => <option key={option}>{option}</option>)}</select>;
  if (kind === "textarea") return <textarea className="wireframe-editable-value wireframe-editable-notes" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} onBlur={commit} rows={3} />;
  return <input className="wireframe-editable-value" type={kind} value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} onBlur={commit} />;
}
