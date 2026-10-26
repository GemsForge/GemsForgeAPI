import { useEffect, useState } from "react";
import { QueryFeedback } from "../../components/QueryFeedback";
import { api } from "../../api";
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
  const [ownership, setOwnership] = useState<{ counts: Record<string, number>; message?: string } | null>(null);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [ownershipBusy, setOwnershipBusy] = useState(false);

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
      <section className="database-panel">
        <div className="database-panel-heading">
          <div>
            <p className="eyebrow">Migration safety</p>
            <h3>Assign existing records to my hub</h3>
          </div>
          <span className="life-mark database-icon" aria-hidden="true">
            ⇄
          </span>
        </div>
        <p className="muted">
          Use this only for legacy rows that already exist with no HubID. It does not create duplicates.
        </p>
        <button
          className="primary-button"
          type="button"
          disabled={ownershipBusy}
          onClick={async () => {
            setOwnershipBusy(true);
            setOwnershipError(null);
            try {
              const result = await api.previewHubOwnership();
              setOwnership({ counts: result.unownedCounts });
            } catch (error) {
              setOwnershipError(error instanceof Error ? error.message : "Could not preview ownership assignment.");
            } finally {
              setOwnershipBusy(false);
            }
          }}
        >
          {ownershipBusy ? "Loading…" : "Preview ownership assignment"}
        </button>
        {ownershipError && <p role="alert">{ownershipError}</p>}
        {ownership && (
          <>
            <p>
              {Object.entries(ownership.counts)
                .filter(([, count]) => count > 0)
                .map(([table, count]) => `${table}: ${count}`)
                .join(" · ") || "No unowned records found."}
            </p>
            <button
              className="secondary-button"
              type="button"
              disabled={ownershipBusy || !Object.values(ownership.counts).some((count) => count > 0)}
              onClick={async () => {
                setOwnershipBusy(true);
                setOwnershipError(null);
                try {
                  const result = await api.assignHubOwnership(ownership.counts);
                  setOwnership({
                    counts: {},
                    message: `Assigned ${Object.values(result.assignedCounts).reduce((sum, count) => sum + count, 0)} records.`,
                  });
                } catch (error) {
                  setOwnershipError(error instanceof Error ? error.message : "Could not assign ownership.");
                } finally {
                  setOwnershipBusy(false);
                }
              }}
            >
              Assign existing records
            </button>
            {ownership.message && <p role="status">{ownership.message}</p>}
          </>
        )}
      </section>
    </>
  );
}
