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
import {
  EditableRecordFields,
  formatRecordCurrency,
  formatRecordDate,
  formatRecordTimestamp,
} from "../../components/EditableRecordFields";
import { useCreateTransactionMutation } from "../../data/recordQueries";
import { TransactionCreateForm } from "../create/RecordCreateForms";
import { useExpenseCategoriesQuery, useExpenseSubcategoriesQuery } from "../../data/lifeQueries";

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
  const categories = useExpenseCategoriesQuery(true);
  const subcategories = useExpenseSubcategoriesQuery(record.categoryID, true);

  return (
    <article className="transaction-detail">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">Expense transaction</p>
          <h3>{record.item}</h3>
          <p className="transaction-code">{record.id}</p>
        </div>
        <span className="status-pill">
          Category {categories.data?.find((category) => category.id === record.categoryID)?.name ?? record.categoryID}
        </span>
      </div>
      <EditableRecordFields
        className="transaction-fields"
        fields={[
          {
            label: "Item",
            value: record.item,
            required: true,
            onSave: async (value) => onPatch({ item: value as string }),
          },
          {
            label: "Receipt",
            value: record.receiptID,
            nullable: true,
            onSave: async (value) => onPatch({ receiptID: value as string | null }),
          },
          {
            label: "First receipt item",
            value: record.firstReceiptItem,
            inputType: "boolean",
            onSave: async (value) => onPatch({ firstReceiptItem: value as boolean }),
          },
          {
            label: "Merchant code",
            value: record.merchantCode,
            nullable: true,
            onSave: async (value) => onPatch({ merchantCode: value as string | null }),
          },
          {
            label: "Transaction date",
            value: record.transactionDate,
            inputType: "date",
            nullable: true,
            displayValue: formatRecordDate(record.transactionDate),
            onSave: async (value) => onPatch({ transactionDate: value as string | null }),
          },
          {
            label: "Category",
            value: record.categoryID,
            inputType: "select",
            options: (categories.data ?? []).map((category) => ({ value: String(category.id), label: category.name })),
            required: true,
            displayValue: categories.data?.find((category) => category.id === record.categoryID)?.name ?? "—",
            onSave: async (value) => onPatch({ categoryID: Number(value) }),
          },
          {
            label: "Subcategory",
            value: record.subcategoryID,
            inputType: "select",
            nullable: true,
            options: (subcategories.data ?? []).map((subcategory) => ({ value: String(subcategory.id), label: subcategory.name })),
            displayValue: subcategories.data?.find((subcategory) => subcategory.id === record.subcategoryID)?.name ?? "—",
            onSave: async (value) => onPatch({ subcategoryID: value == null || value === "" ? null : Number(value) }),
          },
          {
            label: "Quantity",
            value: record.quantity,
            inputType: "number",
            step: "0.01",
            onSave: async (value) => onPatch({ quantity: value as number }),
          },
          {
            label: "Regular price",
            value: record.regularPrice,
            inputType: "number",
            step: "0.01",
            nullable: true,
            displayValue: formatRecordCurrency(record.regularPrice),
            onSave: async (value) => onPatch({ regularPrice: value as number | null }),
          },
          {
            label: "Paid price",
            value: record.paidPrice,
            inputType: "number",
            step: "0.01",
            nullable: true,
            displayValue: formatRecordCurrency(record.paidPrice),
            onSave: async (value) => onPatch({ paidPrice: value as number | null }),
          },
          {
            label: "Total",
            value: record.total,
            inputType: "number",
            step: "0.01",
            nullable: true,
            displayValue: formatRecordCurrency(record.total),
            onSave: async (value) => onPatch({ total: value as number | null }),
          },
          {
            label: "Discount",
            value: record.discount,
            inputType: "number",
            step: "0.01",
            nullable: true,
            displayValue: formatRecordCurrency(record.discount),
            onSave: async (value) => onPatch({ discount: value as number | null }),
          },
          {
            label: "Notes",
            value: record.notes,
            inputType: "longText",
            nullable: true,
            className: "record-notes",
            onSave: async (value) => onPatch({ notes: value as string | null }),
          },
          {
            label: "Last updated",
            value: record.updatedAt ?? null,
            readOnlyReason: "Server managed",
            displayValue: formatRecordTimestamp(record.updatedAt),
          },
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
