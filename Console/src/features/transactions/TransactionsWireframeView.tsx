import type { ExpenseTransaction } from "../../types";
import { transactionTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { WireframeSchemaInspector } from "../workspace/WireframeSchemaInspector";

export function TransactionsWireframeView({ records }: { records: readonly ExpenseTransaction[] }) {
  return (
    <WireframeCollectionView
      config={{
        tableName: "ExpenseTransaction",
        title: "Expense Tracker",
        description: "Purchases, receipts, categories, and spending history.",
        activeCollection: "Expense Tracker",
        records,
        searchValues: (record) => [record.item, record.merchantCode ?? "", record.transactionDate ?? ""],
        cardTitle: (record) => record.item,
        cardSubtitle: (record) => record.merchantCode ?? "Uncategorized",
        cardStatus: (record) => (record.total == null ? "Amount pending" : `$${record.total.toFixed(2)}`),
        cardMeta: (record) => record.transactionDate ?? "No date",
        inspector: (record) => (
          <WireframeSchemaInspector record={record} properties={transactionTableAdapter.getPropertyDefinitions()} />
        ),
      }}
    />
  );
}
