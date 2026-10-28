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
import { EditableRecordFields } from "../../components/EditableRecordFields";
import { transactionEditableFields } from "./transactionRecordFields";
import { useExpenseCategoriesQuery, useExpenseSubcategoriesQuery, useMerchantsQuery } from "../../data/lifeQueries";
import { RecordImport } from "../../components/RecordImport";
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
  const { publish, importConfig, actions, createForm } = useTransactionRecordActions({
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
          {records.length === 0 && (
            <button type="button" onClick={() => setCreating(true)}>
              Add transaction
            </button>
          )}
        </div>
        <RecordImport
          {...importConfig}
          open={importing}
          onOpenChange={setImporting}
          showTrigger={records.length === 0}
          onPublish={publish}
        />
      </div>
      {creating && createForm(() => setCreating(false))}

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
            onRecordPatch={async (record, field, value) => {
              await patch.mutateAsync({ id: record.id, patch: { [field]: value } as Partial<ExpenseTransaction> });
            }}
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
        fields={transactionEditableFields(record, categories.data ?? [], subcategories.data ?? [], merchants, onPatch)}
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
