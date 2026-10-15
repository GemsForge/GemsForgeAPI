import type { ReactNode } from "react";

export interface GemRecordListProps<Record> {
  records: Record[];
  label: string;
  className?: string;
  getKey: (record: Record) => string;
  renderRecord: (record: Record) => ReactNode;
}

/** Shared accessible list boundary for selectable feature records. */
export function GemRecordList<Record>({ records, label, className = "gem-record-list", getKey, renderRecord }: GemRecordListProps<Record>) {
  return (
    <div className={className} aria-label={label}>
      {records.map((record) => <div key={getKey(record)}>{renderRecord(record)}</div>)}
    </div>
  );
}
