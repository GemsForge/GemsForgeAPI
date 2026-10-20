import type { ReactNode } from "react";
import { Accordion } from "@tamagui/accordion";

export interface GemRecordListProps<Record> {
  records: Record[];
  label: string;
  className?: string;
  getKey: (record: Record) => string;
  renderRecord: (record: Record) => ReactNode;
  isExpanded?: (record: Record) => boolean;
  renderExpanded?: (record: Record) => ReactNode;
  onExpandedChange?: (key: string | null) => void;
}

/** Shared accessible list boundary for selectable feature records. */
export function GemRecordList<Record>({
  records,
  label,
  className = "gem-record-list",
  getKey,
  renderRecord,
  isExpanded,
  renderExpanded,
  onExpandedChange,
}: GemRecordListProps<Record>) {
  const expandedKey = records.find((record) => isExpanded?.(record))
    ? getKey(records.find((record) => isExpanded?.(record)) as Record)
    : undefined;

  return (
    <Accordion
      className={className}
      aria-label={label}
      type="single"
      collapsible
      value={expandedKey}
      onValueChange={(value) => onExpandedChange?.(value || null)}
    >
      {records.map((record) => {
        const key = getKey(record);
        return (
          <Accordion.Item key={key} value={key} className="gem-record-list-row">
            <Accordion.Header>
              <Accordion.Trigger asChild>{renderRecord(record)}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>
              {isExpanded?.(record) && <div className="gem-record-expansion">{renderExpanded?.(record)}</div>}
            </Accordion.Content>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}
