import type { ExpenseTransaction } from "../../types";
import { useTransactionPatchMutation } from "../../data/recordQueries";
import { useExpenseCategoriesQuery, useExpenseSubcategoriesQuery, useMerchantsQuery } from "../../data/lifeQueries";
import { createTransactionTableAdapter } from "../database/recordTableAdapters";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";
import { TransactionsInspector } from "./TransactionsInspector";
import { useTablePropertyDefinitionsQuery } from "../../data/workflowQueries";
import { useTransactionRecordActions } from "./useTransactionRecordActions";
import type { RecordPropertyDefinition } from "../../table-kit";

export function TransactionsWireframeView({ records }: { records: readonly ExpenseTransaction[] }) {
  const recordActions = useTransactionRecordActions({ onCreated: () => undefined });
  const patch = useTransactionPatchMutation();
  const categories = useExpenseCategoriesQuery(true);
  const subcategories = useExpenseSubcategoriesQuery(null, true);
  const merchants = useMerchantsQuery(true);
  const relationDefinitions = useTablePropertyDefinitionsQuery("Transactions");
  const transactionTableAdapter = createTransactionTableAdapter(
    categories.data ?? [],
    subcategories.data ?? [],
    merchants.data ?? [],
  );
  const fieldByProperty: Record<string, keyof ExpenseTransaction> = {
    item: "item",
    merchantCode: "merchantCode",
    firstReceiptItem: "firstReceiptItem",
    quantity: "quantity",
    regularPrice: "regularPrice",
    total: "total",
    notes: "notes",
    category: "categoryID",
    subcategory: "subcategoryID",
  };
  const properties = transactionTableAdapter.getPropertyDefinitions().map((property) => {
    const relation = relationDefinitions.data?.find(
      (definition) =>
        definition.kind === "Relation" &&
        definition.sourceColumnName?.toLowerCase() === property.sourceField?.toLowerCase(),
    );
    if (!relation) return property;
    return {
      ...property,
      kind: "relation" as const,
      getValue: (record: ExpenseTransaction) => {
        const current = property.getValue(record);
        const id = current.raw == null ? "" : String(current.raw);
        return {
          ...current,
          href:
            id && relation.targetTableName
              ? `/schema-wireframe/${encodeURIComponent(relation.targetTableName)}/record/${encodeURIComponent(id)}`
              : undefined,
        };
      },
    };
  });
  return (
    <WireframeCollectionView
      config={{
        tableName: "ExpenseTransaction",
        title: "Expense Tracker",
        description: "Purchases, receipts, categories, and spending history.",
        activeCollection: "Expense Tracker",
        records,
        properties,
        newRecordUtility: recordActions.actions.newRecordUtility,
        searchValues: (record) => [
          record.item,
          merchants.data?.find(({ id }) => id === record.merchantCode)?.name ?? "",
          record.transactionDate ?? "",
        ],
        cardTitle: (record) => record.item,
        cardSubtitle: (record) => merchants.data?.find(({ id }) => id === record.merchantCode)?.name ?? "Uncategorized",
        cardStatus: (record) => (record.total == null ? "Amount pending" : `$${record.total.toFixed(2)}`),
        cardMeta: (record) => record.transactionDate ?? "No date",
        inspector: (record, schemaProperties) => (
          <TransactionsInspector
            record={record}
            properties={properties.map((property): RecordPropertyDefinition<ExpenseTransaction> => {
              const field = fieldByProperty[property.id];
              const numeric = ["quantity", "regularPrice", "paidPrice", "total", "discount"].includes(property.id);
              const options =
                property.id === "category"
                  ? (categories.data ?? []).map(({ id, name }) => ({ value: String(id), label: name }))
                  : property.id === "subcategory"
                    ? (subcategories.data ?? [])
                        .filter((subcategory) => subcategory.categoryID === record.categoryID)
                        .map(({ id, name }) => ({ value: String(id), label: name }))
                    : property.id === "merchantCode"
                      ? (merchants.data ?? []).map(({ id, name }) => ({ value: id, label: name }))
                      : property.id === "firstReceiptItem"
                        ? [
                            { value: "true", label: "Yes" },
                            { value: "false", label: "No" },
                          ]
                        : undefined;
              return {
                ...property,
                kind: numeric ? "number" : property.kind,
                edit: field
                  ? {
                      inputType: options
                        ? "select"
                        : numeric
                          ? "number"
                          : property.kind === "date"
                            ? "date"
                            : property.id === "notes"
                              ? "longText"
                              : "text",
                      nullable: property.id === "subcategory" || property.id === "merchantCode",
                      options,
                      onSave: (_record: unknown, value: string | number | null) => {
                        const next = value === "" || value === null ? null : Number(value);
                        const values =
                          property.id === "category"
                            ? { categoryID: next, subcategoryID: null }
                            : property.id === "subcategory"
                              ? { subcategoryID: next }
                              : property.id === "merchantCode"
                                ? { merchantCode: value === "" ? null : String(value) }
                                : property.id === "firstReceiptItem"
                                  ? { firstReceiptItem: value === "true" }
                                  : { [field]: numeric ? (value === "" ? null : Number(value)) : value || null };
                        return patch
                          .mutateAsync({
                            id: record.id,
                            patch: values as Partial<ExpenseTransaction>,
                          })
                          .then(() => undefined);
                      },
                    }
                  : undefined,
              };
            })}
            schemaProperties={schemaProperties}
          />
        ),
      }}
    />
  );
}
