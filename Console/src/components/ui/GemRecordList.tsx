import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
  tableColumns?: Array<{
    key: string;
    label: string;
    render: (record: Record) => ReactNode;
    icon?: (record: Record) => ReactNode;
    visible?: boolean;
  }>;
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
  const [visibleColumns, setVisibleColumns] = useState(
    () => new Set(tableColumns.filter((column) => column.visible !== false).map((column) => column.key)),
  );
  const [propertySearch, setPropertySearch] = useState("");
  useEffect(() => {
    setVisibleColumns((current) => {
      const availableKeys = new Set(tableColumns.map((column) => column.key));
      const next = new Set([...current].filter((key) => availableKeys.has(key)));
      if (next.size === 0) tableColumns.forEach((column) => column.visible !== false && next.add(column.key));
      if (next.size === current.size && [...next].every((key) => current.has(key))) return current;
      return next;
    });
  }, [tableColumns]);
  const activeColumns = tableColumns.filter((column) => visibleColumns.has(column.key));
  const filteredColumns = tableColumns.filter((column) =>
    column.label.toLowerCase().includes(propertySearch.trim().toLowerCase()),
  );
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
      <XStack className="gem-record-view-toggle" aria-label={`${label} view controls`}>
        <details className="gem-record-view-menu">
          <summary>View: {view[0].toUpperCase() + view.slice(1)}</summary>
          <div role="menu" aria-label={`${label} views`}>
            {(["list", "gallery", "table"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={view === option}
                onClick={() => setView(option)}
              >
                {option[0].toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </details>
        {tableColumns.length > 0 && (
          <details className="gem-record-property-menu">
            <summary>Properties</summary>
            <div role="group" aria-label={`${label} visible properties`}>
              <label className="gem-record-property-search">
                <span className="sr-only">Search properties</span>
                <input
                  type="search"
                  value={propertySearch}
                  onChange={(event) => setPropertySearch(event.target.value)}
                  placeholder="Search properties…"
                />
              </label>
              <button
                type="button"
                onClick={() => setVisibleColumns(new Set(tableColumns.map((column) => column.key)))}
              >
                Show all
              </button>
              <button type="button" onClick={() => setVisibleColumns(new Set())}>
                Hide all
              </button>
              {filteredColumns.map((column) => (
                <div key={column.key} className="gem-record-property-option">
                  <input
                    type="checkbox"
                    aria-label={`Show ${column.label} property`}
                    checked={visibleColumns.has(column.key)}
                    onChange={() =>
                      setVisibleColumns((current) => {
                        const next = new Set(current);
                        if (next.has(column.key)) next.delete(column.key);
                        else next.add(column.key);
                        return next;
                      })
                    }
                  />
                  <span>{column.label}</span>
                </div>
              ))}
            </div>
          </details>
        )}
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
            <caption className="sr-only">{label} table</caption>
            <thead>
              <tr>
                {activeColumns.map((column) => (
                  <th key={column.key} scope="col">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={getKey(record)}>
                  {activeColumns.map((column) => (
                    <td key={column.key}>
                      {column.icon ? (
                        <span className="gem-record-table-icon" aria-hidden="true">
                          {column.icon(record)}
                        </span>
                      ) : null}
                      {column.render(record)}
                    </td>
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
