import type { TableActionsProps } from "../../table-kit";
import type { ReactNode } from "react";
import { AddressCreateForm } from "../create/RecordCreateForms";
import { useCreateAddressMutation } from "../../data/recordQueries";
import { createRecordImportActions } from "../../components/createRecordImportActions";

interface AddressRecordActionsOptions {
  /** Selects a newly created address in the owning feature view. */
  onCreated: (id: string) => void;
}

interface AddressRecordActionsResult {
  create: ReturnType<typeof useCreateAddressMutation>;
  actions: TableActionsProps;
  createForm: (onCancel: () => void) => ReactNode;
}

/**
 * Compose address-owned create and intake actions for the shared Table Kit.
 * The hook owns feature behavior; the table owns only menu structure and UI.
 */
export function useAddressRecordActions({
  onCreated,
}: AddressRecordActionsOptions): AddressRecordActionsResult {
  const create = useCreateAddressMutation();
  const publish = async (rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      await create.mutateAsync(row as Parameters<typeof create.mutateAsync>[0]);
    }
  };
  const createForm = (onCancel: () => void) => (
    <AddressCreateForm
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
    createForm,
    actions: {
      newRecordUtility: {
        options: [
          {
            id: "new-address",
            label: "Input Form",
            description: "Open the address form.",
            render: ({ close }) => createForm(close),
          },
          ...createRecordImportActions({
            idPrefix: "address",
            label: "addresses",
            expectedColumns: ["id", "addressType", "country"],
            onPublish: publish,
          }),
        ],
      },
    },
  };
}
