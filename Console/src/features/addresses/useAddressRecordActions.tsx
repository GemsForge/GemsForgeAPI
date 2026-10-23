import type { TableActionsProps } from "../../table-kit";
import { RecordImport } from "../../components/RecordImport";
import { AddressCreateForm } from "../create/RecordCreateForms";
import { useCreateAddressMutation } from "../../data/recordQueries";

interface AddressRecordActionsOptions {
  /** Selects a newly created address in the owning feature view. */
  onCreated: (id: string) => void;
}

interface AddressRecordActionsResult {
  create: ReturnType<typeof useCreateAddressMutation>;
  actions: TableActionsProps;
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

  return {
    create,
    actions: {
      newRecordUtility: {
        options: [
          {
            id: "new-address",
            label: "Input Form",
            description: "Open the address form.",
            render: ({ close }) => (
              <AddressCreateForm
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
            id: "import-address-file",
            label: "Import File",
            description: "Choose a CSV or JSON file.",
            render: ({ close }) => (
              <RecordImport
                label="addresses"
                expectedColumns={["id", "addressType", "country"]}
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
            id: "paste-address-data",
            label: "Paste data",
            description: "Paste CSV or JSON records.",
            render: ({ close }) => (
              <RecordImport
                label="addresses"
                expectedColumns={["id", "addressType", "country"]}
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
