import type { ExpenseTransaction } from "../../types";
import { useTransactionPatchMutation } from "../../data/recordQueries";
import { transactionTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";
import { useTransactionRecordActions } from "./useTransactionRecordActions";
import type { RecordPropertyDefinition } from "../../table-kit";

export function TransactionsWireframeView({ records }: { records: readonly ExpenseTransaction[] }) {
  const recordActions = useTransactionRecordActions({ onCreated: () => undefined });
  const patch = useTransactionPatchMutation();
  const fieldByProperty: Record<string, keyof ExpenseTransaction> = {
    item: "item",
    merchantCode: "merchantCode",
    date: "transactionDate",
    quantity: "quantity",
    regularPrice: "regularPrice",
    paidPrice: "paidPrice",
    total: "total",
    discount: "discount",
    notes: "notes",
  };
  const properties = transactionTableAdapter.getPropertyDefinitions();
  return (
    <WireframeCollectionView
      config={{
        tableName: "ExpenseTransaction",
        title: "Expense Tracker",
        description: "Purchases, receipts, categories, and spending history.",
        activeCollection: "Expense Tracker",
        records,
        newRecordUtility: recordActions.actions.newRecordUtility,
        searchValues: (record) => [record.item, record.merchantCode ?? "", record.transactionDate ?? ""],
        cardTitle: (record) => record.item,
        cardSubtitle: (record) => record.merchantCode ?? "Uncategorized",
        cardStatus: (record) => (record.total == null ? "Amount pending" : `$${record.total.toFixed(2)}`),
        cardMeta: (record) => record.transactionDate ?? "No date",
        inspector: (record, schemaProperties) => (
          <WireframeSchemaInspector
            record={record}
            properties={[...properties.map((property): RecordPropertyDefinition<ExpenseTransaction> => {
              const field = fieldByProperty[property.id];
              const numeric = ["quantity", "regularPrice", "paidPrice", "total", "discount"].includes(property.id);
              return {
                ...property,
                kind: numeric ? "number" : property.kind,
                edit: field
                  ? {
                      inputType: numeric
                        ? "number"
                        : property.kind === "date"
                          ? "date"
                          : property.id === "notes"
                            ? "longText"
                            : "text",
                      onSave: (_record: unknown, value: string | number | null) =>
                        patch
                          .mutateAsync({
                            id: record.id,
                            patch: { [field]: numeric ? (value === "" ? null : Number(value)) : value || null },
                          })
                          .then(() => undefined),
                    }
                  : undefined,
              };
            }), ...(schemaProperties ?? [])]}
          />
        ),
      }}
    />
  );
}
