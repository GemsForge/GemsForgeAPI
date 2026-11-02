import type { ExpenseTransaction } from "../../types";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";

export function TransactionsWireframeView({ records }: { records: readonly ExpenseTransaction[] }) {
  return <WireframeCollectionView config={{ title: "Expense Tracker", description: "Purchases, receipts, categories, and spending history.", activeCollection: "Expense Tracker", records, searchValues: (record) => [record.item, record.merchantCode ?? "", record.transactionDate ?? ""], cardTitle: (record) => record.item, cardSubtitle: (record) => record.merchantCode ?? "Uncategorized", cardStatus: (record) => record.total == null ? "Amount pending" : `$${record.total.toFixed(2)}`, cardMeta: (record) => record.transactionDate ?? "No date", inspector: (record) => <dl><div><dt>Item</dt><dd>{record.item}</dd></div><div><dt>Merchant</dt><dd>{record.merchantCode ?? "—"}</dd></div><div><dt>Transaction date</dt><dd>{record.transactionDate ?? "—"}</dd></div><div><dt>Quantity</dt><dd>{record.quantity}</dd></div><div><dt>Total</dt><dd>{record.total == null ? "—" : `$${record.total.toFixed(2)}`}</dd></div><div><dt>Notes</dt><dd>{record.notes ?? "No notes yet."}</dd></div></dl> }} />;
}

