import { useState, type ComponentProps, type ReactNode } from "react";
import { RecordImport } from "./RecordImport";
import { GemEmptyState } from "./ui";

/** Shared page contract for record collections with empty-state actions. */
export interface RecordPageProps {
  title: string;
  description: string;
  recordCount: number;
  recordLabel: string;
  importLabel?: string;
  expectedColumns: string[];
  onImport: ComponentProps<typeof RecordImport>["onPublish"];
  renderCreateForm: (close: () => void) => ReactNode;
  emptyIcon?: string;
  emptyTitle: string;
  emptyDescription: string;
  children: ReactNode;
}

/** Shared heading, empty-state actions, and collection boundary. */
export function RecordPage({
  title,
  description,
  recordCount,
  recordLabel,
  importLabel = `${recordLabel}s`,
  expectedColumns,
  onImport,
  renderCreateForm,
  emptyIcon = "✦",
  emptyTitle,
  emptyDescription,
  children,
}: RecordPageProps) {
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const isEmpty = recordCount === 0;

  return (
    <>
      <div className="content-heading">
        <div>
          <p className="eyebrow">Life-area records</p>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <div className="button-row">
          <span className="record-count">
            {recordCount} {recordLabel}
          </span>
          {isEmpty && (
            <button type="button" onClick={() => setCreating(true)}>
              Add {recordLabel}
            </button>
          )}
        </div>
        <RecordImport
          label={importLabel}
          expectedColumns={expectedColumns}
          open={importing}
          onOpenChange={setImporting}
          showTrigger={isEmpty}
          onPublish={onImport}
        />
      </div>

      {creating && renderCreateForm(() => setCreating(false))}
      {isEmpty ? <GemEmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} /> : children}
    </>
  );
}
