import type { TableActionsProps } from "../../table-kit";
import type { ReactNode } from "react";
import { createRecordImportActions } from "../../components/createRecordImportActions";
import { EducationCreateForm } from "../create/RecordCreateForms";
import { useCreateEducationMutation } from "../../data/recordQueries";
import type { Address } from "../../types";
import type { RecordImportConfig } from "../../components/RecordImport";

const educationImportConfig: RecordImportConfig = {
  label: "education records",
  expectedColumns: ["id", "educationType", "institutionName", "status"],
};

interface EducationRecordActionsOptions {
  /** Addresses available to the education form. */
  addresses: Address[];
  /** Selects a newly created record in the owning feature view. */
  onCreated: (id: string) => void;
}

interface EducationRecordActionsResult {
  publish: (rows: Record<string, unknown>[]) => Promise<void>;
  importConfig: RecordImportConfig;
  actions: TableActionsProps;
  createForm: (onCancel: () => void) => ReactNode;
}

/**
 * Compose Education-owned create and intake actions for the shared Table Kit.
 * The hook owns feature behavior; the table owns only menu structure and UI.
 */
export function useEducationRecordActions({
  addresses,
  onCreated,
}: EducationRecordActionsOptions): EducationRecordActionsResult {
  const create = useCreateEducationMutation();
  const publish = async (rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      await create.mutateAsync(row as Parameters<typeof create.mutateAsync>[0]);
    }
  };
  const createForm = (onCancel: () => void) => (
    <EducationCreateForm
      addresses={addresses}
      onCancel={onCancel}
      onCreate={async (payload) => {
        const created = await create.mutateAsync(payload);
        onCreated(created.id);
        onCancel();
      }}
    />
  );

  return {
    publish,
    importConfig: educationImportConfig,
    createForm,
    actions: {
      newRecordUtility: {
        options: [
          {
            id: "new-education",
            label: "Input Form",
            description: "Open the education form.",
            render: ({ close }) => createForm(close),
          },
          ...createRecordImportActions({
            idPrefix: "education",
            ...educationImportConfig,
            onPublish: publish,
          }),
        ],
      },
    },
  };
}
