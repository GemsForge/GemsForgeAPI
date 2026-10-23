import { RecordImport } from "./RecordImport";
import type { TableNewRecordUtilityOption } from "../table-kit";

interface RecordImportActionsOptions {
  /** Stable feature prefix used to identify the two utility choices. */
  idPrefix: string;
  /** Human-readable resource label passed to the import workflow. */
  label: string;
  /** External column contract for the resource being imported. */
  expectedColumns: string[];
  /** Feature-owned publish behavior for normalized import rows. */
  onPublish: (rows: Record<string, unknown>[]) => Promise<void>;
}

/** Build the shared file and paste import choices for a feature-owned action menu. */
export function createRecordImportActions({
  idPrefix,
  label,
  expectedColumns,
  onPublish,
}: RecordImportActionsOptions): TableNewRecordUtilityOption[] {
  return (["file", "paste"] as const).map((mode) => ({
    id: `import-${idPrefix}-${mode}`,
    label: mode === "file" ? "Import File" : "Paste data",
    description: mode === "file" ? "Choose a CSV or JSON file." : "Paste CSV or JSON records.",
    render: ({ close }) => (
      <RecordImport
        label={label}
        expectedColumns={expectedColumns}
        mode={mode}
        open
        onOpenChange={(open) => !open && close()}
        showTrigger={false}
        onPublish={onPublish}
      />
    ),
  }));
}
