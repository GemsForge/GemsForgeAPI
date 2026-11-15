import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GemButton } from "@gemsforge/ui";
import { useNavigate } from "react-router-dom";
import { APIError } from "../../api";
import { useDropTableMutation, usePreviewTableDropMutation } from "../../data/workflowQueries";
import type { TableDropPreview } from "../../types";
import { keepDialogTabFocus } from "../workspace/WireframePropertyEditor";

export function TableDropDialog({
  tableName,
  onClose,
  onSuccess,
}: {
  tableName: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const navigate = useNavigate();
  const previewMutation = usePreviewTableDropMutation();
  const dropMutation = useDropTableMutation(tableName);
  const [preview, setPreview] = useState<TableDropPreview | null>(null);
  const [typedName, setTypedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);

  const refreshPreview = async () => {
    setError(null);
    try {
      setPreview(await previewMutation.mutateAsync(tableName));
      setTypedName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The deletion preview could not be loaded.");
    }
  };

  useEffect(() => {
    void refreshPreview();
    // The dialog is mounted only when opened for this table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const confirm = async () => {
    if (!preview || typedName !== tableName || preview.blockingReferences.length > 0) return;
    setError(null);
    try {
      const result = await dropMutation.mutateAsync({
        confirmationToken: preview.confirmationToken,
        typedTableName: typedName,
      });
      const successMessage = `${tableName} was deleted. Backup preserved as ${result.backupFileName}.`;
      onSuccess(successMessage);
      onClose();
      navigate("/", { state: { successMessage } });
    } catch (caught) {
      if (caught instanceof APIError && caught.status === 409 && isTableDropPreview(caught.details)) {
        setPreview(caught.details);
        setTypedName("");
        setError("The table changed since this preview. Review the refreshed details before confirming again.");
      } else {
        setError(caught instanceof Error ? caught.message : "The table could not be deleted.");
      }
    }
  };

  const busy = previewMutation.isPending || dropMutation.isPending;
  return createPortal(
    <div
      className="wireframe-property-details-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="wireframe-property-details table-drop-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-drop-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) {
            event.preventDefault();
            onClose();
            return;
          }
          keepDialogTabFocus(event, event.currentTarget);
        }}
      >
        <GemButton
          type="button"
          variant="quiet"
          tone="secondary"
          aria-label="Close delete table preview"
          onClick={onClose}
          disabled={busy}
        >
          ×
        </GemButton>
        <div className="wireframe-property-details-heading">
          <div>
            <h2 id="table-drop-title" className="wireframe-property-dialog-title">
              Delete table
            </h2>
            <p>
              Review the impact before deleting <strong>{tableName}</strong>.
            </p>
          </div>
        </div>
        {!preview && !error ? <p role="status">Loading deletion preview…</p> : null}
        {preview ? (
          <div className="table-drop-preview" aria-live="polite">
            <p>
              <strong>{preview.rowCount}</strong> rows in this Hub; <strong>{preview.totalDatabaseRowCount}</strong>{" "}
              rows in the table.
            </p>
            <details>
              <summary>Metadata that will be removed</summary>
              <ul>
                {Object.entries(preview.metadata).map(([label, count]) => (
                  <li key={label}>
                    {humanize(label)}: {count}
                  </li>
                ))}
              </ul>
            </details>
            {preview.filesThatWouldBecomeUnreferenced.length > 0 ? (
              <div>
                <strong>Files that will become unreferenced (file contents are kept)</strong>
                <ul>
                  {preview.filesThatWouldBecomeUnreferenced.map((file) => (
                    <li key={file.fileMetadataID}>{file.relativePath}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {preview.blockingReferences.length > 0 ? (
              <div role="alert">
                <strong>Deletion is blocked</strong>
                <ul>
                  {preview.blockingReferences.map((blocker, index) => (
                    <li key={`${blocker.kind}-${blocker.table}-${index}`}>{blocker.reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <ul>
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {error ? (
          <p className="wireframe-system-error" role="alert">
            {error}
          </p>
        ) : null}
        {preview && preview.blockingReferences.length === 0 ? (
          <label className="table-drop-confirm-label">
            Type <code>{tableName}</code> to confirm
            <input value={typedName} onChange={(event) => setTypedName(event.currentTarget.value)} autoComplete="off" />
          </label>
        ) : null}
        <div className="wireframe-system-trash-actions">
          <GemButton type="button" variant="quiet" tone="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </GemButton>
          <GemButton
            type="button"
            variant="outlined"
            tone="secondary"
            className="is-danger"
            onClick={() => void confirm()}
            disabled={busy || !preview || preview.blockingReferences.length > 0 || typedName !== tableName}
          >
            {dropMutation.isPending ? "Creating backup and deleting…" : "Create backup and delete table"}
          </GemButton>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function isTableDropPreview(value: unknown): value is TableDropPreview {
  return typeof value === "object" && value !== null && "confirmationToken" in value && "blockingReferences" in value;
}

function humanize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());
}
