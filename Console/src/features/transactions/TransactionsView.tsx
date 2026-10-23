import { useState } from "react";
import {
  useTransactionPatchMutation,
  useTransactionQuery,
  useTransactionImageMutation,
} from "../../data/recordQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import type { ExpenseTransaction } from "../../types";
import { AttachmentControl } from "../../components/AttachmentControl";
import { GemEmptyState } from "../../components/ui";
import {
  EditableRecordFields,
  formatRecordCurrency,
  formatRecordDate,
  formatRecordTimestamp,
} from "../../components/EditableRecordFields";
import { TransactionCreateForm } from "../create/RecordCreateForms";
import { useExpenseCategoriesQuery, useExpenseSubcategoriesQuery, useMerchantsQuery } from "../../data/lifeQueries";
import { RecordImport } from "../../components/RecordImport";
import { RecordCreateButton } from "../../components/RecordCreateButton";
import { useRecordUtilities } from "../../hooks/useRecordUtilities";
import { DatabaseRecordCollection } from "../../components/DatabaseRecordCollection";
import { transactionTableAdapter } from "../database/recordTableAdapters";
import { useTransactionRecordActions } from "./useTransactionRecordActions";

interface TransactionsViewProps {
  records: ExpenseTransaction[];
}

export function TransactionsView({ records }: TransactionsViewProps) {
  const utilities = useRecordUtilities(
    records,
    (record) => [record.id, record.item, record.transactionDate, record.merchantCode],
    {
      date: (a, b) => (a.transactionDate ?? "").localeCompare(b.transactionDate ?? ""),
      item: (a, b) => a.item.localeCompare(b.item),
      merchant: (a, b) => (a.merchantCode ?? "").localeCompare(b.merchantCode ?? ""),
      total: (a, b) => (a.total ?? 0) - (b.total ?? 0),
      paid: (a, b) => (a.paidPrice ?? 0) - (b.paidPrice ?? 0),
      category: (a, b) => a.categoryID - b.categoryID,
      subcategory: (a, b) => (a.subcategoryID ?? 0) - (b.subcategoryID ?? 0),
    },
  );
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const detail = useTransactionQuery(selectedID);
  const attachment = useTransactionImageMutation();
  const patch = useTransactionPatchMutation();
  const selectedRecord = detail.data;
  const merchants = useMerchantsQuery(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const { create, actions } = useTransactionRecordActions({
    onCreated: setSelectedID,
  });

  return (
    <>
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
          {records.length === 0 && <RecordCreateButton label="transaction" onCreate={() => setCreating(true)} />}
        </div>
        <RecordImport
          label="transactions"
          expectedColumns={["id", "item", "categoryID", "quantity"]}
          open={importing}
          onOpenChange={setImporting}
          showTrigger={records.length === 0}
          onPublish={async (rows) => {
            for (const row of rows) await create.mutateAsync(row as Parameters<typeof create.mutateAsync>[0]);
          }}
        />
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
          <DatabaseRecordCollection
            label="Transactions"
            records={records}
            utilities={utilities}
            adapter={transactionTableAdapter}
            sortOptions={[
              { value: "date", label: "Transaction date" },
              { value: "item", label: "Item" },
              { value: "merchant", label: "Merchant" },
              { value: "total", label: "Total" },
              { value: "paid", label: "Paid price" },
              { value: "category", label: "Category" },
              { value: "subcategory", label: "Subcategory" },
            ]}
            filterOptions={Array.from(
              new Set(records.map((record) => record.merchantCode).filter((value): value is string => Boolean(value))),
            ).sort()}
            detailId={selectedID}
            onDetailChange={setSelectedID}
            actions={actions}
            detail={
              selectedID ? (
                <>
                  <QueryFeedback query={detail} />
                  {selectedRecord && (
                    <TransactionDetail
                      key={selectedRecord.id}
                      record={selectedRecord}
                      merchants={merchants.data ?? []}
                      onAttachment={async (metadata) => {
                        await attachment.mutateAsync({ id: selectedRecord.id, fileID: metadata?.id ?? null });
                      }}
                      onPatch={async (values) => {
                        await patch.mutateAsync({ id: selectedRecord.id, patch: values });
                      }}
                    />
                  )}
                </>
              ) : null
            }
          />
        </div>
      )}
    </>
  );
}

function TransactionDetail({
  record,
  merchants,
  onAttachment,
  onPatch,
}: {
  record: ExpenseTransaction;
  merchants: import("../../types").Merchant[];
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
            label: "Merchant",
            value: record.merchantCode,
            inputType: "select",
            nullable: true,
            options: merchants.map((merchant) => ({ value: merchant.id, label: merchantDisplayName(merchant.name) })),
            displayValue: merchantDisplayName(merchants.find((merchant) => merchant.id === record.merchantCode)?.name),
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
            options: (subcategories.data ?? []).map((subcategory) => ({
              value: String(subcategory.id),
              label: subcategory.name,
            })),
            displayValue:
              subcategories.data?.find((subcategory) => subcategory.id === record.subcategoryID)?.name ?? "—",
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

function merchantDisplayName(name?: string) {
  if (!name) return "—";
  return name.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{So}\p{Sk}\s]+/u, "").trim() || name;
}
