import { WireframeEditableValue } from "./WireframeEditableValue";
import { WireframePropertyEditor } from "./WireframePropertyEditor";
import type { ReactNode } from "react";

export type WireframeInspectorField = {
  id: string;
  label: string;
  value: string;
  kind?: "text" | "select" | "status" | "number" | "date" | "textarea";
  options?: string[];
  display?: ReactNode;
  displayValue?: ReactNode;
  onCommit?: (value: string) => Promise<void>;
};

export function WireframeRecordInspector({ fields }: { fields: readonly WireframeInspectorField[] }) {
  return (
    <dl aria-label="Record properties">
      {fields.map((field) => (
        <div key={field.id}>
          <dt data-property-kind={field.kind ?? "text"}>
            <WireframePropertyEditor label={field.label} value={field.value} kind={field.kind} />
          </dt>
          <dd>
            {field.onCommit ? (
              <WireframeEditableValue
                label={field.label}
                value={field.value}
                displayValue={field.displayValue}
                kind={field.kind}
                options={field.options}
                onCommit={field.onCommit}
              />
            ) : (
              (field.display ?? field.value) || "—"
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
