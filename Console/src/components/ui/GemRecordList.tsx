import type { ReactNode } from "react";
import { useState } from "react";
import { Accordion } from "@tamagui/accordion";
import { Card, XStack } from "tamagui";

export interface GemRecordListProps<Record> {
  records: Record[];
  label: string;
  className?: string;
  getKey: (record: Record) => string;
  renderRecord: (record: Record) => ReactNode;
  isExpanded?: (record: Record) => boolean;
  renderExpanded?: (record: Record) => ReactNode;
  onExpandedChange?: (key: string | null) => void;
  tableColumns?: Array<{ key: string; label: string; render: (record: Record) => ReactNode }>;
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
  tableColumns = [],
}: GemRecordListProps<Record>) {
  const [view, setView] = useState<"list" | "gallery" | "table">("list");
  const expandedKey = records.find((record) => isExpanded?.(record))
    ? getKey(records.find((record) => isExpanded?.(record)) as Record)
    : undefined;

  const activeIndex = expandedKey ? records.findIndex((record) => getKey(record) === expandedKey) : 0;
  const selectRecord = (index: number) => {
    const record = records[index];
    if (record) onExpandedChange?.(getKey(record));
  };

  return (
    <div className={`gem-record-collection is-${view}`}>
      <XStack className="gem-record-view-toggle" aria-label={`${label} view`}>
        <span>View</span>
        <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
          List
        </button>
        <button type="button" aria-pressed={view === "gallery"} onClick={() => setView("gallery")}>
          Gallery
        </button>
        <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
          Table
        </button>
      </XStack>
      {view === "gallery" ? (
        <XStack className="gem-record-grid-shell">
          <button
            type="button"
            className="gem-record-grid-nav"
            aria-label={`Previous ${label.toLowerCase()} record`}
            onClick={() => selectRecord(Math.max(0, activeIndex - 1))}
            disabled={activeIndex <= 0}
          >
            ←
          </button>
          <XStack className={`${className} gem-record-grid-rail`} flexWrap="wrap" aria-label={`${label} records`}>
            {records.map((record) => {
              const key = getKey(record);
              return (
                <Card
                  key={key}
                  className={`gem-record-grid-card${key === expandedKey ? " is-active" : ""}`}
                  size={key === expandedKey ? "lg" : "md"}
                  data-card-view="grid"
                >
                  {renderRecord(record)}
                </Card>
              );
            })}
          </XStack>
          <button
            type="button"
            className="gem-record-grid-nav"
            aria-label={`Next ${label.toLowerCase()} record`}
            onClick={() => selectRecord(Math.min(records.length - 1, activeIndex + 1))}
            disabled={activeIndex >= records.length - 1}
          >
            →
          </button>
        </XStack>
      ) : view === "table" ? (
        <div className="gem-record-table-wrap" role="region" aria-label={`${label} table`} tabIndex={0}>
          <table className="gem-record-table">
            <thead>
              <tr>
                {tableColumns.map((column) => (
                  <th key={column.key} scope="col">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={getKey(record)}>
                  {tableColumns.map((column) => (
                    <td key={column.key}>{column.render(record)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
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
      )}
    </div>
  );
}
