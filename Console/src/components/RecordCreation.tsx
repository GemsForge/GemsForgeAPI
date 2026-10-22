import type { ComponentProps, ReactNode } from "react";
import { RecordImport } from "./RecordImport";
import type { TableNewRecordUtilityProps } from "../table-kit";

/** Creation workflows supported by the shared New Record utility. */
export type CreationMode = "form" | "file" | "clipboard";
type CloseHandler = () => void;

interface CreationOption {
  mode: CreationMode;
  id: string;
  label: string;
  description: string;
}

/** Describe one standardized creation action for a record type. */
export function getCreationOption(mode: CreationMode, recordType: string): CreationOption {
  switch (mode) {
    case "form":
      return { mode, id: `new-${recordType}`, label: "Input Form", description: `Open the ${recordType} form.` };
    case "file":
      return { mode, id: `import-${recordType}-file`, label: "Import File", description: "Choose a CSV or JSON file." };
    case "clipboard":
      return {
        mode,
        id: `clipboard-${recordType}-data`,
        label: "Paste data",
        description: "Paste CSV or JSON records.",
      };
  }
}

/** Domain-owned inputs used to create a record through any supported workflow. */
export interface RecordCreationConfig {
  recordType: string;
  importLabel: string;
  expectedColumns: string[];
  onImport: ComponentProps<typeof RecordImport>["onPublish"];
  renderForm: (close: CloseHandler) => ReactNode;
}

interface RecordCreationProps extends RecordCreationConfig {
  mode: CreationMode;
  onClose: CloseHandler;
}

/** Render the selected form, file import, or clipboard import workflow. */
export function RecordCreation({
  mode,
  onClose,
  importLabel,
  expectedColumns,
  onImport,
  renderForm,
}: RecordCreationProps) {
  if (mode === "form") return <>{renderForm(onClose)}</>;

  return (
    <RecordImport
      label={importLabel}
      expectedColumns={expectedColumns}
      mode={mode === "clipboard" ? "paste" : "file"}
      open
      showTrigger={false}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onPublish={onImport}
    />
  );
}

/** Build the shared New Record utility contract for a domain record page. */
export function createRecordCreationActions(config: RecordCreationConfig): {
  newRecordUtility: TableNewRecordUtilityProps;
} {
  const options = (["form", "file", "clipboard"] as const).map((mode) => getCreationOption(mode, config.recordType));

  return {
    newRecordUtility: {
      options: options.map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description,
        render: ({ close }) => <RecordCreation {...config} mode={option.mode} onClose={close} />,
      })),
    },
  };
}
