import { WireframeEditableValue } from "./WireframeEditableValue";
import { WireframePropertyEditor } from "./WireframePropertyEditor";
import type { ReactNode } from "react";
import type { RecordNumberFormat } from "../../table-kit/recordContracts";
import type { RecordPropertyKind } from "../../table-kit/recordContracts";

export type WireframeInspectorField = {
  id: string;
  label: string;
  value: string;
  kind?: "text" | "select" | "status" | "number" | "date" | "url" | "email" | "textarea";
  propertyKind?: RecordPropertyKind;
  propertyType?: string;
  iconName?: string;
  numberFormat?: RecordNumberFormat;
  nullable?: boolean;
  options?: readonly (string | { value: string; label: string })[];
  display?: ReactNode;
  displayValue?: ReactNode;
  onCommit?: (value: string) => Promise<void>;
};

export function WireframeRecordInspector({ fields }: { fields: readonly WireframeInspectorField[] }) {
  return (
    <dl aria-label="Record properties">
      {fields.map((field) => (
        <div key={field.id}>
          <dt
            data-property-id={field.id}
            data-property-kind={field.propertyKind ?? field.kind ?? "text"}
            data-property-type={field.propertyType}
            data-property-icon={field.iconName}
            data-property-number-format={field.numberFormat}
          >
            <WireframePropertyEditor
              label={field.label}
              value={field.value}
              kind={field.propertyKind ?? field.kind}
              numberFormat={field.numberFormat}
              propertyType={field.propertyType}
              iconName={field.iconName}
              propertyID={field.id}
            />
          </dt>
          <dd>
            {field.onCommit ? (
              <WireframeEditableValue
                label={field.label}
                value={field.value}
                displayValue={field.displayValue}
                kind={field.kind}
                options={field.options}
                nullable={field.nullable}
                onCommit={field.onCommit}
              />
            ) : (
              field.kind === "url" && field.value ? (
                <a className="primitive-value-link" href={field.value} target="_blank" rel="noreferrer">{field.display ?? field.value}</a>
              ) : (
                (field.display ?? field.value) || "—"
              )
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
