import { useEffect, useState } from "react";
import { useLiveSchemaQuery } from "../../data/workflowQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { LiveSchemaTable } from "../../types";

interface LiveSchemaViewProps {
  onError: (error: unknown) => void;
}

export function LiveSchemaView({ onError }: LiveSchemaViewProps) {
  const query = useLiveSchemaQuery();
  const schema = query.data;
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);

  useEffect(() => {
    if (query.error) onError(query.error);
  }, [query.error, onError]);

  const selectedTable = schema?.tables.find((table) => table.name === selectedTableName) ?? schema?.tables[0] ?? null;

  return (
    <>
      <div className="content-heading">
        <div>
          <p className="eyebrow">Developer tools · read only</p>
          <h2>Live Schema</h2>
          <p className="muted">
            Inspect the configured Gem Life database before we allow any schema changes. This view does not create,
            alter, or delete anything.
          </p>
        </div>
        <span className="record-count ready">{schema?.tableCount ?? 0} tables</span>
      </div>

      {!schema ? (
        <QueryFeedback query={query} />
      ) : (
        <div className="schema-layout">
          <section className="schema-panel">
            <div className="database-panel-heading">
              <div>
                <p className="eyebrow">Database</p>
                <h3>{schema.databaseName}</h3>
              </div>
              <span className="life-mark database-icon">⌘</span>
            </div>
            <div className="schema-table-list">
              {schema.tables.map((table) => (
                <button
                  className={`schema-table-button ${table.name === selectedTableName ? "selected" : ""}`}
                  key={table.name}
                  onClick={() => setSelectedTableName(table.name)}
                >
                  <span className="schema-table-icon">▦</span>
                  <span>
                    <strong>{table.name}</strong>
                    <small>
                      {table.columns.length} columns · {table.foreignKeys.length} foreign keys
                    </small>
                  </span>
                  <span className="arrow">›</span>
                </button>
              ))}
            </div>
          </section>
          <SchemaTableDetail table={selectedTable} />
        </div>
      )}
    </>
  );
}

function SchemaTableDetail({ table }: { table: LiveSchemaTable | null }) {
  if (!table)
    return (
      <div className="detail-placeholder">
        <span>▦</span>
        <p>Select a table to inspect its structure.</p>
      </div>
    );

  return (
    <section className="schema-panel">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">Table structure</p>
          <h3>{table.name}</h3>
        </div>
        <span className="record-count">{table.columns.length} columns</span>
      </div>
      <div className="schema-columns">
        {table.columns.map((column) => (
          <div className="schema-column" key={column.name}>
            <div>
              <strong>{column.name}</strong>
              <small>{column.dataType || "unspecified"}</small>
            </div>
            <span>{column.primaryKey ? "Primary key" : column.nullable ? "Nullable" : "Required"}</span>
          </div>
        ))}
      </div>
      <div className="schema-section">
        <h4>Relationships</h4>
        {table.foreignKeys.length ? (
          table.foreignKeys.map((key) => (
            <p key={`${key.column}-${key.referencedTable}`}>
              {key.column} → {key.referencedTable}.{key.referencedColumn}
            </p>
          ))
        ) : (
          <p className="muted">No foreign keys reported.</p>
        )}
      </div>
      <div className="schema-section">
        <h4>Indexes</h4>
        {table.indexes.length ? (
          table.indexes.map((index) => (
            <p key={index.name}>
              {index.name} · {index.unique ? "unique" : "non-unique"} ·{" "}
              {index.columns.join(", ") || "no columns reported"}
            </p>
          ))
        ) : (
          <p className="muted">No indexes reported.</p>
        )}
      </div>
    </section>
  );
}
