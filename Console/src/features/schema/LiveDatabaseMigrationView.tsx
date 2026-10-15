import { useEffect, useState } from "react";
import { QueryFeedback } from "../../components/QueryFeedback";
import {
  useExecuteRepositoryMigrationsMutation,
  useLiveSchemaQuery,
  usePreviewRepositoryMigrationsMutation,
} from "../../data/workflowQueries";

interface LiveDatabaseMigrationViewProps {
  onError: (error: unknown) => void;
  onSuccess: (message: string) => void;
}

export function LiveDatabaseMigrationView({ onError, onSuccess }: LiveDatabaseMigrationViewProps) {
  const schema = useLiveSchemaQuery();
  const preview = usePreviewRepositoryMigrationsMutation();
  const execute = useExecuteRepositoryMigrationsMutation();
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);

  useEffect(() => {
    if (schema.error) onError(schema.error);
  }, [schema.error, onError]);

  async function previewMigrations() {
    try {
      const result = await preview.mutateAsync();
      setConfirmationToken(result.confirmationToken);
    } catch (error) {
      onError(error);
    }
  }

  async function executeMigrations() {
    if (!confirmationToken) return;
    try {
      const result = await execute.mutateAsync(confirmationToken);
      setConfirmationToken(null);
      preview.reset();
      onSuccess(`Migration complete. Backup preserved at ${result.backupFileName}.`);
      await schema.refetch();
    } catch (error) {
      onError(error);
    }
  }

  const busy = preview.isPending || execute.isPending;
  return (
    <>
      <div className="content-heading">
        <div>
          <p className="eyebrow">Developer tools · live database</p>
          <h2>Repository migrations</h2>
          <p className="muted">
            Bring the configured live database up to the repository schema with a preview, an explicit confirmation, and
            a verified backup.
          </p>
        </div>
        <span className="record-count ready">Backup first</span>
      </div>
      <section className="database-panel">
        <div className="database-panel-heading">
          <div>
            <p className="eyebrow">Migration safety</p>
            <h3>Apply the repository schema</h3>
          </div>
          <span className="life-mark database-icon">⇄</span>
        </div>
        <p>
          No database change occurs during preview. Execution creates a verified backup first, then applies pending
          repository migrations and refreshes the schema view.
        </p>
        <QueryFeedback query={schema} />
        {schema.data ? (
          <p className="muted">
            Connected to <strong>{schema.data.databaseName}</strong> · {schema.data.tableCount} tables currently
            visible.
          </p>
        ) : null}
        <button className="primary-button" disabled={busy} onClick={() => void previewMigrations()}>
          {preview.isPending ? "Preparing preview…" : "Preview repository migrations"}
        </button>
        {preview.data ? (
          <div className="builder-preview">
            <h4>Ready for confirmation</h4>
            <p>
              {preview.data.migrationNames.length} migration{preview.data.migrationNames.length === 1 ? "" : "s"}{" "}
              registered.
            </p>
            {preview.data.migrationNames.map((name) => (
              <p key={name}>
                • <code>{name}</code>
              </p>
            ))}
            <p className="muted">Confirmation expires at {new Date(preview.data.expiresAt).toLocaleTimeString()}.</p>
            <div className="button-row">
              <button className="primary-button" disabled={busy} onClick={() => void executeMigrations()}>
                {execute.isPending ? "Backing up and migrating…" : "Confirm backup and migrate"}
              </button>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  setConfirmationToken(null);
                  preview.reset();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
