import type { TableActionsProps } from "../../table-kit";
import { RecordImport } from "../../components/RecordImport";
import { TransactionCreateForm } from "../create/RecordCreateForms";
import { useCreateTransactionMutation } from "../../data/recordQueries";

interface TransactionRecordActionsOptions {
  /** Selects a newly created transaction in the owning feature view. */
  onCreated: (id: string) => void;
}

interface TransactionRecordActionsResult {
  create: ReturnType<typeof useCreateTransactionMutation>;
  actions: TableActionsProps;
}

/**
 * Compose transaction-owned create and intake actions for the shared Table Kit.
 * The hook owns feature behavior; the table owns only menu structure and UI.
 */
export function useTransactionRecordActions({
  onCreated,
}: TransactionRecordActionsOptions): TransactionRecordActionsResult {
  const create = useCreateTransactionMutation();
  const publish = async (rows: Record<string, unknown>[]) => {
    for (const row of rows) await create.mutateAsync(row as Parameters<typeof create.mutateAsync>[0]);
  };
  const importProps = { label: "transactions", expectedColumns: ["id", "item", "categoryID", "quantity"] };

  return {
    create,
    actions: {
      newRecordUtility: {
        options: [
          {
            id: "new-transaction",
            label: "Input Form",
            description: "Open the transaction form.",
            render: ({ close }) => (
              <TransactionCreateForm
                onCancel={close}
                onCreate={async (payload) => {
                  const created = await create.mutateAsync(payload);
                  onCreated(created.id);
                  close();
                }}
              />
            ),
          },
          ...(["file", "paste"] as const).map((mode) => ({
            id: `import-transaction-${mode}`,
            label: mode === "file" ? "Import File" : "Paste data",
            description: mode === "file" ? "Choose a CSV or JSON file." : "Paste CSV or JSON records.",
            render: ({ close }: { close: () => void }) => (
              <RecordImport
                {...importProps}
                mode={mode}
                open
                onOpenChange={(open) => !open && close()}
                showTrigger={false}
                onPublish={publish}
              />
            ),
          })),
        ],
      },
    },
  };
}
