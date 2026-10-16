import type { ReactNode } from "react";

export interface RecordFieldDefinition {
  label: string;
  value: ReactNode;
  className?: string;
}

/** Shared semantic field layout; resource screens own their labels and values. */
export function RecordFields({ fields, className }: { fields: RecordFieldDefinition[]; className?: string }) {
  return (
    <dl className={className ? `record-fields ${className}` : "record-fields"}>
      {fields.map(({ label, value, className: fieldClassName }) => (
        <div className={fieldClassName} key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
