import { useState } from "react";
import { api } from "../../api";
import type { ExpenseTransaction } from "../../types";

interface TransactionsViewProps {
  records: ExpenseTransaction[];
}

export function TransactionsView({ records }: TransactionsViewProps) {
  const [selectedRecord, setSelectedRecord] = useState<ExpenseTransaction | null>(null);

  async function selectRecord(record: ExpenseTransaction) {
    setSelectedRecord(await api.getTransaction(record.id));
  }

  return (
    <>
      <div className="content-heading">
        <div>
          <p className="eyebrow">Life-area records</p>
          <h2>Expense Tracker</h2>
          <p className="muted">Read documented expenses from the existing Transactions table. Service Accounts, categories, and images remain separate follow-up features.</p>
        </div>
        <span className="record-count">{records.length} records</span>
      </div>

      {records.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">$</div><h3>No expense transactions</h3><p>The Transactions table did not return any records.</p></div>
      ) : (
        <div className="transaction-layout">
          <div className="transaction-list" aria-label="Expense transactions">
            {records.map((record) => (
              <button className={`transaction-card ${selectedRecord?.id === record.id ? "selected" : ""}`} key={record.id} onClick={() => void selectRecord(record)}>
                <span className="transaction-icon">$</span>
                <span className="transaction-card-copy"><strong>{record.item}</strong><small>{record.transactionDate || "Undated"} · {record.id}</small></span>
                <span className="transaction-total">{formatAmount(record.total ?? record.paidPrice)}</span>
              </button>
            ))}
          </div>
          {selectedRecord ? <TransactionDetail record={selectedRecord} /> : <div className="detail-placeholder"><span>$</span><p>Select an expense transaction to view its details.</p></div>}
        </div>
      )}
    </>
  );
}

function TransactionDetail({ record }: { record: ExpenseTransaction }) {
  return (
    <article className="transaction-detail">
      <div className="detail-heading"><div><p className="eyebrow">Expense transaction</p><h3>{record.item}</h3><p className="transaction-code">{record.id}</p></div><span className="status-pill">Category {record.categoryID}</span></div>
      <dl className="transaction-fields">
        <Field label="Transaction date" value={record.transactionDate} />
        <Field label="Receipt" value={record.receiptID} />
        <Field label="Merchant code" value={record.merchantCode} />
        <Field label="Category ID" value={String(record.categoryID)} />
        <Field label="Subcategory ID" value={record.subcategoryID === null ? null : String(record.subcategoryID)} />
        <Field label="Quantity" value={String(record.quantity)} />
        <MoneyField label="Regular price" value={record.regularPrice} />
        <MoneyField label="Paid price" value={record.paidPrice} />
        <MoneyField label="Total" value={record.total} />
        <MoneyField label="Discount" value={record.discount} />
        <div className="transaction-notes"><dt>Notes</dt><dd>{record.notes || "—"}</dd></div>
      </dl>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return <div><dt>{label}</dt><dd>{value || "—"}</dd></div>;
}

function MoneyField({ label, value }: { label: string; value: number | null }) {
  return <div><dt>{label}</dt><dd>{formatAmount(value)}</dd></div>;
}

function formatAmount(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
