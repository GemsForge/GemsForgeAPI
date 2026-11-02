import { WireframeEditableValue } from "./WireframeEditableValue";

export type WireframeInspectorField = {
  id: string;
  label: string;
  value: string;
  kind?: "text" | "select" | "status" | "date" | "textarea";
  options?: string[];
  onCommit?: (value: string) => Promise<void>;
};

export function WireframeRecordInspector({ fields }: { fields: readonly WireframeInspectorField[] }) {
  return (
    <dl>
      {fields.map((field) => (
        <div key={field.id}>
          <dt>{field.label}</dt>
          <dd>
            {field.onCommit ? (
              <WireframeEditableValue
                label={field.label}
                value={field.value}
                kind={field.kind}
                options={field.options}
                onCommit={field.onCommit}
              />
            ) : (
              field.value || "—"
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
