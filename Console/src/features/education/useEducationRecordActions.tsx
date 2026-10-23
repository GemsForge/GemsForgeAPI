import type { TableActionsProps } from "../../table-kit";
import { RecordImport } from "../../components/RecordImport";
import { EducationCreateForm } from "../create/RecordCreateForms";
import { useCreateEducationMutation } from "../../data/recordQueries";
import type { Address } from "../../types";

interface EducationRecordActionsOptions {
  /** Addresses available to the education form. */
  addresses: Address[];
  /** Selects a newly created record in the owning feature view. */
  onCreated: (id: string) => void;
}

interface EducationRecordActionsResult {
  create: ReturnType<typeof useCreateEducationMutation>;
  actions: TableActionsProps;
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

  return {
    create,
    actions: {
      newRecordUtility: {
        options: [
          {
            id: "new-education",
            label: "Input Form",
            description: "Open the education form.",
            render: ({ close }) => (
              <EducationCreateForm
                addresses={addresses}
                onCancel={close}
                onCreate={async (payload) => {
                  const created = await create.mutateAsync(payload);
                  onCreated(created.id);
                  close();
                }}
              />
            ),
          },
          {
            id: "import-education-file",
            label: "Import File",
            description: "Choose a CSV or JSON file.",
            render: ({ close }) => (
              <RecordImport
                label="education records"
                expectedColumns={["id", "educationType", "institutionName", "status"]}
                mode="file"
                open
                onOpenChange={(open) => {
                  if (!open) close();
                }}
                showTrigger={false}
                onPublish={publish}
              />
            ),
          },
          {
            id: "paste-education-data",
            label: "Paste data",
            description: "Paste CSV or JSON records.",
            render: ({ close }) => (
              <RecordImport
                label="education records"
                expectedColumns={["id", "educationType", "institutionName", "status"]}
                mode="paste"
                open
                onOpenChange={(open) => {
                  if (!open) close();
                }}
                showTrigger={false}
                onPublish={publish}
              />
            ),
          },
        ],
      },
    },
  };
}
