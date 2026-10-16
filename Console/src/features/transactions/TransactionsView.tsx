import { usePagedRecords } from "../../hooks/usePagedRecords";
import { PaginationControls } from "../../components/PaginationControls";
import { useState } from "react";
import {
  useTransactionPatchMutation,
  useTransactionQuery,
  useTransactionImageMutation,
} from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { ExpenseTransaction } from "../../types";
import { AttachmentControl } from "../../components/AttachmentControl";
import { GemEmptyState, GemRecordCard, GemRecordList } from "../../components/ui";
import { useCreateTransactionMutation } from "../../data/recordQueries";
import { TransactionCreateForm } from "../create/RecordCreateForms";

interface TransactionsViewProps {
  records: ExpenseTransaction[];
}

export function TransactionsView({ records }: TransactionsViewProps) {
  const paging = usePagedRecords(records);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const detail = useTransactionQuery(selectedID);
  const attachment = useTransactionImageMutation();
  const patch = useTransactionPatchMutation();
  const selectedRecord = detail.data;
  const [creating, setCreating] = useState(false);
  const create = useCreateTransactionMutation();

  return (
    <>
      <PaginationControls {...paging} label="Transactions" />
      <div className="content-heading">
        <div>
          <p className="eyebrow">Life-area records</p>
          <h2>Expense Tracker</h2>
          <p className="muted">
            Read documented expenses from the existing Transactions table. Images are attached after record creation.
          </p>
        </div>
        <div className="button-row">
          <span className="record-count">{records.length} records</span>
          <button type="button" onClick={() => setCreating(true)}>
            Add transaction
          </button>
        </div>
      </div>

      {creating && (
        <TransactionCreateForm
          onCancel={() => setCreating(false)}
          onCreate={async (payload) => {
            const created = await create.mutateAsync(payload);
            setSelectedID(created.id);
            setCreating(false);
          }}
        />
      )}

      {records.length === 0 ? (
        <GemEmptyState
          icon="$"
          title="No expense transactions"
          description="The Transactions table did not return any records."
        />
      ) : (
        <div className="transaction-layout">
          <GemRecordList
            className="transaction-list"
            records={paging.items}
            label="Expense transactions"
            getKey={(record) => record.id}
            renderRecord={(record) => (
              <GemRecordCard
                className="transaction-card"
                icon="$"
                title={record.item}
                subtitle={`${record.transactionDate || "Undated"} · ${record.id}`}
                status={formatAmount(record.total ?? record.paidPrice)}
                selected={selectedID === record.id}
                onSelect={() => setSelectedID(record.id)}
              />
            )}
          />
          <div>
            <QueryFeedback query={detail} />
            {selectedRecord ? (
              <TransactionDetail
                key={selectedRecord.id}
                record={selectedRecord}
                saving={patch.isPending}
                error={patch.error}
                onAttachment={async (metadata) => {
                  await attachment.mutateAsync({ id: selectedRecord.id, fileID: metadata?.id ?? null });
                }}
                onPatch={async (values) => {
                  await patch.mutateAsync({ id: selectedRecord.id, patch: values });
                }}
              />
            ) : (
              !selectedID && (
                <div className="detail-placeholder">
                  <span>$</span>
                  <p>Select an expense transaction to view its details.</p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}

function TransactionDetail({
  record,
  saving,
  error,
  onAttachment,
  onPatch,
}: {
  record: ExpenseTransaction;
  saving: boolean;
  error: Error | null;
  onAttachment: (metadata: import("../../types").FileMetadata | null) => Promise<void>;
  onPatch: (values: Partial<ExpenseTransaction>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [item, setItem] = useState(record.item);
  return (
    <article className="transaction-detail">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">Expense transaction</p>
          <h3>{record.item}</h3>
          <p className="transaction-code">{record.id}</p>
        </div>
        <span className="status-pill">Category {record.categoryID}</span>
      </div>
      {editing ? (
        <form
          className="edit-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (item === record.item) {
              setEditing(false);
              return;
            }
            await onPatch({ item });
            setEditing(false);
          }}
        >
          <label>
            Item
            <input value={item} onChange={(event) => setItem(event.target.value)} />
          </label>
          {error && <p role="alert">{error.message} Try again.</p>}
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save item"}
          </button>
          <button
            type="button"
            onClick={() => {
              setItem(record.item);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing(true)}>
          Edit item
        </button>
      )}
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
        <div className="transaction-notes">
          <dt>Notes</dt>
          <dd>{record.notes || "—"}</dd>
        </div>
      </dl>
      <AttachmentControl
        fileMetadataID={record.image}
        ownerType="ExpenseTransaction"
        ownerID={record.id}
        label="Receipt image"
        onAttach={onAttachment}
      />
    </article>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

function MoneyField({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{formatAmount(value)}</dd>
    </div>
  );
}

function formatAmount(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
