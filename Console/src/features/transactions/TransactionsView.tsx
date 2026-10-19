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
import { RecordFields } from "../../components/RecordFields";
import { PropertyEditor } from "../../components/PropertyEditor";
import { useCreateTransactionMutation } from "../../data/recordQueries";
import { TransactionCreateForm } from "../create/RecordCreateForms";
import { RecordImport } from "../../components/RecordImport";

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
          <RecordImport label="transactions" onPublish={async (rows) => { for (const row of rows) await create.mutateAsync(row as Parameters<typeof create.mutateAsync>[0]); }} />
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
  onAttachment,
  onPatch,
}: {
  record: ExpenseTransaction;
  onAttachment: (metadata: import("../../types").FileMetadata | null) => Promise<void>;
  onPatch: (values: Partial<ExpenseTransaction>) => Promise<void>;
}) {
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
      <PropertyEditor
        label="Item"
        initialValue={record.item}
        editLabel="Edit item"
        saveLabel="Save item"
        onSave={async (item) => onPatch({ item })}
      />
      <RecordFields
        className="transaction-fields"
        fields={[
          { label: "Transaction date", value: record.transactionDate || "—" },
          { label: "Receipt", value: record.receiptID || "—" },
          { label: "Merchant code", value: record.merchantCode || "—" },
          { label: "Category ID", value: String(record.categoryID) },
          { label: "Subcategory ID", value: record.subcategoryID === null ? "—" : String(record.subcategoryID) },
          { label: "Quantity", value: String(record.quantity) },
          { label: "Regular price", value: formatAmount(record.regularPrice) },
          { label: "Paid price", value: formatAmount(record.paidPrice) },
          { label: "Total", value: formatAmount(record.total) },
          { label: "Discount", value: formatAmount(record.discount) },
          { label: "Notes", value: record.notes || "—", className: "record-notes" },
        ]}
      />
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

function formatAmount(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
