import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { QueryFeedback } from "../../components/QueryFeedback";
import { DatabaseRecordCollection } from "../../components/DatabaseRecordCollection";
import { RecordFields } from "../../components/RecordFields";
import { GemEmptyState } from "@gemsforge/ui";
import { useSchemaPageRecordsQuery, useSchemaPageTablesQuery } from "../../data/workflowQueries";
import { useRecordUtilities } from "../../hooks/useRecordUtilities";
import { createLiveSchemaProperties, type RecordAdapter, type RecordPropertyDefinition } from "../../table-kit";

type SchemaRecord = Record<string, unknown> & { id: string };

export function SchemaTablePage({ showHeading = true }: { showHeading?: boolean }) {
  const { tableName = "" } = useParams();
  const tables = useSchemaPageTablesQuery();
  const [offset, setOffset] = useState(0);
  const result = useSchemaPageRecordsQuery(tableName, offset);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  useEffect(() => {
    setOffset(0);
    setSelectedID(null);
  }, [tableName]);
  const table = result.data?.table ?? tables.data?.tables.find((candidate) => candidate.name === tableName);
  const primaryKey = table?.columns.find((column) => column.primaryKey)?.name;
  const records = useMemo<SchemaRecord[]>(
    () =>
      (result.data?.rows ?? []).map((row) => ({
        ...row,
        id: String((primaryKey ? row[primaryKey] : undefined) ?? ""),
      })),
    [primaryKey, result.data?.rows],
  );
  const properties = useMemo<readonly RecordPropertyDefinition<SchemaRecord>[]>(
    () => (table ? createLiveSchemaProperties<SchemaRecord>(table).filter((property) => property.id !== "HubID") : []),
    [table],
  );
  const adapter = useMemo<RecordAdapter<SchemaRecord>>(
    () => ({
      toTableRecord: (record, index) => {
        const primary =
          properties.find((property) => property.primary && property.id !== "ID") ??
          properties.find((property) => property.id !== "ID");
        const title = primary ? String(record[primary.id] ?? record.id) : record.id || `Record ${index + 1}`;
        return { id: record.id || String(index), source: record, title };
      },
      getPropertyDefinitions: () => properties,
    }),
    [properties],
  );
  const sortOptions = useMemo(
    () =>
      Object.fromEntries(
        properties.map((property) => [
          property.id,
          (left: SchemaRecord, right: SchemaRecord) =>
            String(left[property.id] ?? "").localeCompare(String(right[property.id] ?? ""), undefined, {
              numeric: true,
            }),
        ]),
      ),
    [properties],
  );
  const utilities = useRecordUtilities(records, (record) => Object.values(record), sortOptions);
  const selected = records.find((record) => record.id === selectedID) ?? null;

  if (tables.isPending || result.isPending) return <p role="status">Loading schema page…</p>;
  if (tables.isError) return <QueryFeedback query={tables} />;
  if (result.isError) return <QueryFeedback query={result} />;
  if (!table)
    return (
      <section>
        <h2>Schema page unavailable</h2>
        <p>This table is no longer available to your Hub.</p>
      </section>
    );

  return (
    <>
      {showHeading ? (
        <div className="content-heading">
          <div>
            <p className="eyebrow">Schema page · {table.columns.length} properties</p>
            <h2>{table.name}</h2>
            <p className="muted">Records from your live database schema.</p>
          </div>
          <span className="record-count">{result.data.totalCount} records</span>
        </div>
      ) : null}
      <DatabaseRecordCollection
        label={table.name}
        records={records}
        utilities={utilities}
        adapter={adapter}
        sortOptions={properties.map((property) => ({ value: property.id, label: property.label }))}
        detailId={selectedID}
        onDetailChange={setSelectedID}
        emptyState={
          result.data.totalCount === 0 ? (
            <GemEmptyState
              icon="▦"
              title={`No ${table.name} records yet`}
              description="This schema page is ready. Add records through the available data workflows, then return here to view them."
            />
          ) : undefined
        }
        detail={
          selected ? (
            <RecordFields
              className="schema-record-detail"
              fields={properties.map((property) => ({
                label: property.label,
                value: property.getValue(selected).display,
              }))}
            />
          ) : undefined
        }
      />
      {result.data.totalCount > result.data.rows.length ? (
        <div className="button-row" aria-label="Schema page record pagination">
          <button
            className="secondary-button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - result.data.limit))}
          >
            Previous records
          </button>
          <span className="muted">
            Showing {offset + 1}–{Math.min(offset + result.data.rows.length, result.data.totalCount)} of{" "}
            {result.data.totalCount}
          </span>
          <button
            className="secondary-button"
            disabled={offset + result.data.rows.length >= result.data.totalCount}
            onClick={() => setOffset(offset + result.data.limit)}
          >
            Next records
          </button>
        </div>
      ) : null}
    </>
  );
}
