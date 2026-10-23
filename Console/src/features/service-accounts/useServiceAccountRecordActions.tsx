import type { TableActionsProps } from "../../table-kit";
import type { ReactNode } from "react";
import { createRecordImportActions } from "../../components/createRecordImportActions";
import { ServiceAccountCreateForm } from "../create/RecordCreateForms";
import { useCreateServiceAccountMutation } from "../../data/recordQueries";
import { serviceAccountImportColumns, toServiceAccountCreatePayload } from "./serviceAccountImportAdapter";

interface ServiceAccountRecordActionsResult {
  create: ReturnType<typeof useCreateServiceAccountMutation>;
  publish: (rows: Record<string, unknown>[]) => Promise<void>;
  actions: TableActionsProps;
  createForm: (onCancel: () => void) => ReactNode;
}

/** Compose Service Account create/import behavior for the shared Table Kit. */
export function useServiceAccountRecordActions({
  onCreated,
}: { onCreated: (id: number) => void }): ServiceAccountRecordActionsResult {
  const create = useCreateServiceAccountMutation();
  const publish = async (rows: Record<string, unknown>[]) => {
    for (const row of rows) await create.mutateAsync(toServiceAccountCreatePayload(row));
  };
  const createForm = (onCancel: () => void) => (
    <ServiceAccountCreateForm
      onCancel={onCancel}
      onCreate={async (payload) => {
        const created = await create.mutateAsync(payload);
        onCreated(created.id);
        onCancel();
      }}
    />
  );

  return {
    create,
    publish,
    createForm,
    actions: {
      newRecordUtility: {
        options: [
          {
            id: "new-service",
            label: "Input Form",
            description: "Open the service account form.",
            render: ({ close }) => createForm(close),
          },
          ...createRecordImportActions({
            idPrefix: "service",
            label: "services",
            expectedColumns: serviceAccountImportColumns,
            onPublish: publish,
          }),
        ],
      },
    },
  };
}
