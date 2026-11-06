import { useEffect, useState } from "react";
import { useCreateSchemaPageMutation, useLiveSchemaQuery, useSchemaPageTablesQuery } from "../../data/workflowQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { LiveSchemaTable } from "../../types";

interface LiveSchemaViewProps {
  onError: (error: unknown) => void;
  onSuccess: (message: string) => void;
}

export function LiveSchemaView({ onError, onSuccess }: LiveSchemaViewProps) {
  const query = useLiveSchemaQuery();
  const pages = useSchemaPageTablesQuery();
  const createPage = useCreateSchemaPageMutation();
  const schema = query.data;
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);

  useEffect(() => {
    if (query.error) onError(query.error);
  }, [query.error, onError]);
  useEffect(() => {
    if (pages.error) onError(pages.error);
  }, [pages.error, onError]);

  const selectedTable = schema?.tables.find((table) => table.name === selectedTableName) ?? schema?.tables[0] ?? null;

  return (
    <>
      <div className="content-heading">
        <div>
          <p className="eyebrow">Developer tools · live schema</p>
          <h2>Live Schema</h2>
          <p className="muted">
            Inspect the configured Gem Life database. Creating a page saves a Hub-scoped view and leaves the table
            schema unchanged.
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
          <SchemaTableDetail
            table={selectedTable}
            isPage={Boolean(pages.data?.tables.some((table) => table.name === selectedTable?.name))}
            isPageStatusPending={pages.isPending}
            isPageStatusError={pages.isError}
            canCreatePage={Boolean(pages.data?.availableTables.some((table) => table.name === selectedTable?.name))}
            isCreating={createPage.isPending}
            onCreatePage={async (table) => {
              try {
                await createPage.mutateAsync(table.name);
                onSuccess(`${table.name} is now available in navigation as a schema page.`);
              } catch (error) {
                onError(error);
              }
            }}
          />
        </div>
      )}
    </>
  );
}

function SchemaTableDetail({
  table,
  isPage,
  isPageStatusPending,
  isPageStatusError,
  canCreatePage,
  isCreating,
  onCreatePage,
}: {
  table: LiveSchemaTable | null;
  isPage: boolean;
  isPageStatusPending: boolean;
  isPageStatusError: boolean;
  canCreatePage: boolean;
  isCreating: boolean;
  onCreatePage: (table: LiveSchemaTable) => Promise<void>;
}) {
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
      {isPage ? (
        <p className="muted" role="status">
          This table is a schema page in navigation.
        </p>
      ) : isPageStatusPending ? (
        <p className="muted" role="status">
          Checking whether this table can become a schema page…
        </p>
      ) : isPageStatusError ? (
        <p className="error-text" role="alert">
          Page availability could not be checked. Try again after the schema page list loads.
        </p>
      ) : canCreatePage ? (
        <button className="primary-button" disabled={isCreating} onClick={() => void onCreatePage(table)}>
          {isCreating ? "Creating page…" : "Create page from this table"}
        </button>
      ) : (
        <p className="muted">This table is not eligible for a Hub-scoped schema page.</p>
      )}
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
