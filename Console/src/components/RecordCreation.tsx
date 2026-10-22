import type { ComponentProps, ReactNode } from "react";
import { RecordImport } from "./RecordImport";

type CreationMode = "form" | "file" | "clipboard";
type CloseHandler = () => void;

interface CreationOption {
  mode: CreationMode;
  id: string;
  label: string;
  description: string;
}

export function getCreationOption(mode: CreationMode, recordType: string): CreationOption {
  switch (mode) {
    case "form":
      return {
        mode,
        id: `new-${recordType}`,
        label: "Input Form",
        description: `Open the ${recordType} form.`,
      };

    case "file":
      return {
        mode,
        id: `import-${recordType}-file`,
        label: "Import File",
        description: "Choose a CSV or JSON file.",
      };

    case "clipboard":
      return {
        mode,
        id: `clipboard-${recordType}-data`,
        label: "Paste data",
        description: "Paste CSV or JSON records.",
      };
  }
}

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

export function RecordCreation({
  mode,
  onClose,
  importLabel,
  expectedColumns,
  onImport,
  renderForm,
}: RecordCreationProps) {
  if (mode === "form") {
    return <>{renderForm(onClose)}</>;
  }

  return (
    <RecordImport
      label={importLabel}
      expectedColumns={expectedColumns}
      mode={mode}
      open
      showTrigger={false}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onPublish={onImport}
    />
  );
}
export function createRecordCreationActions(config: RecordCreationConfig) {
  const options: CreationOption[] = [
    getCreationOption("form", config.recordType),
    getCreationOption("file", config.recordType),
    getCreationOption("clipboard", config.recordType),
  ];

  return {
    newRecordUtility: {
      options: options.map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description,
        render: ({ close }: { close: CloseHandler }) => (
          <RecordCreation {...config} mode={option.mode} onClose={close} />
        ),
      })),
    },
  };
}
