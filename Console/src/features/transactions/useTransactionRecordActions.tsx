import type { TableActionsProps } from "../../table-kit";
import type { ReactNode } from "react";
import { createRecordImportActions } from "../../components/createRecordImportActions";
import { TransactionCreateForm } from "../create/RecordCreateForms";
import { useCreateTransactionMutation } from "../../data/recordQueries";

interface TransactionRecordActionsOptions {
  /** Selects a newly created transaction in the owning feature view. */
  onCreated: (id: string) => void;
}

interface TransactionRecordActionsResult {
  create: ReturnType<typeof useCreateTransactionMutation>;
  actions: TableActionsProps;
  createForm: (onCancel: () => void) => ReactNode;
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
  const createForm = (onCancel: () => void) => (
    <TransactionCreateForm
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
            id: "new-transaction",
            label: "Input Form",
            description: "Open the transaction form.",
            render: ({ close }) => createForm(close),
          },
          ...createRecordImportActions({
            idPrefix: "transaction",
            label: "transactions",
            expectedColumns: ["id", "item", "categoryID", "quantity"],
            onPublish: publish,
          }),
        ],
      },
    },
  };
}
