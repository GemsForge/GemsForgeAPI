import type { ReactNode } from "react";

export interface GemDataTableColumn<Row> {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
}

export interface GemDataTableProps<Row> {
  columns: GemDataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  caption: string;
}

/** Accessible table primitive for structured records and read-only views. */
export function GemDataTable<Row>({ columns, rows, rowKey, caption }: GemDataTableProps<Row>) {
  return (
    <div className="data-table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="data-table">
        <caption>{caption}</caption>
        <thead><tr>{columns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={rowKey(row)}>{columns.map((column) => <td key={column.key}>{column.render(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
