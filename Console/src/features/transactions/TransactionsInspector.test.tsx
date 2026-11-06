import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "@gemsforge/ui";
import { api } from "../../api";
import type { ExpenseTransaction, TablePropertyDefinition } from "../../types";
import type { RecordPropertyDefinition } from "../../table-kit";
import { TransactionsInspector } from "./TransactionsInspector";

const record: ExpenseTransaction = {
  id: "TRX-1",
  receiptID: null,
  item: "Coffee",
  firstReceiptItem: false,
  categoryID: 1,
  subcategoryID: 2,
  merchantCode: null,
  transactionDate: null,
  quantity: 1,
  regularPrice: null,
  paidPrice: null,
  total: null,
  discount: null,
  notes: null,
};

const definitions: TablePropertyDefinition[] = [
  {
    id: "transaction-category",
    tableName: "Transactions",
    name: "Category",
    kind: "Relation",
    sourceColumnName: "CategoryID",
    targetTableName: "BudgetCategories",
    targetKeyColumnName: "CategoryID",
    targetDisplayColumnName: "Category",
    relationDefinitionID: null,
    targetColumnName: null,
    filterByDefinitionID: null,
    targetFilterColumnName: null,
    sortOrder: 0,
  },
  {
    id: "transaction-subcategory",
    tableName: "Transactions",
    name: "Subcategory",
    kind: "Relation",
    sourceColumnName: "SubcategoryID",
    targetTableName: "BudgetSubcategories",
    targetKeyColumnName: "SubcategoryID",
    targetDisplayColumnName: "Subcategory",
    relationDefinitionID: null,
    targetColumnName: null,
    filterByDefinitionID: "transaction-category",
    targetFilterColumnName: "CategoryID",
    sortOrder: 1,
  },
  {
    id: "transaction-lookup-category-type",
    tableName: "Transactions",
    name: "Category type",
    kind: "Lookup",
    sourceColumnName: null,
    targetTableName: null,
    targetKeyColumnName: null,
    targetDisplayColumnName: null,
    relationDefinitionID: "transaction-category",
    targetColumnName: "CategoryType",
    filterByDefinitionID: null,
    targetFilterColumnName: null,
    sortOrder: 2,
  },
];

const properties: RecordPropertyDefinition<ExpenseTransaction>[] = [
  {
    id: "category",
    label: "Category",
    kind: "select",
    sourceField: "categoryID",
    getValue: (item) => ({ raw: item.categoryID, display: String(item.categoryID) }),
    edit: { onSave: async () => undefined },
  },
  {
    id: "subcategory",
    label: "Subcategory",
    kind: "select",
    sourceField: "subcategoryID",
    getValue: (item) => ({ raw: item.subcategoryID, display: String(item.subcategoryID) }),
    edit: { onSave: async () => undefined },
  },
];

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <TransactionsInspector record={record} properties={properties} />
      </QueryClientProvider>
    </TamaguiProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("TransactionsInspector relations and lookups", () => {
  it("links related records, shows computed lookups, and searches options before saving their IDs", async () => {
    vi.spyOn(api, "getTablePropertyDefinitions").mockResolvedValue(definitions);
    vi.spyOn(api, "getTablePropertyValues").mockResolvedValue([
      { definitionID: "transaction-category", recordID: "1", displayValue: "Food", value: "Food" },
      { definitionID: "transaction-subcategory", recordID: "2", displayValue: "Produce", value: "Produce" },
      { definitionID: "transaction-lookup-category-type", recordID: "1", displayValue: "Variable", value: "Variable" },
    ]);
    const optionSpy = vi.spyOn(api, "getRelatedRecordOptions").mockResolvedValue([{ id: "3", name: "Travel" }]);
    const patchSpy = vi
      .spyOn(api, "patchTransaction")
      .mockResolvedValue({ ...record, categoryID: 3, subcategoryID: null });

    setup();

    const categoryLink = await screen.findByRole("link", { name: "Food" });
    expect(categoryLink).toHaveAttribute("href", "/schema-wireframe/BudgetCategories/record/1");
    expect(await screen.findByText("Variable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Category" }));
    expect(await screen.findByLabelText("Search Category")).toBeInTheDocument();
    await screen.findByRole("option", { name: "Travel" });
    expect(optionSpy).toHaveBeenCalledWith("Transactions", "transaction-category", "", "TRX-1", expect.anything());
    fireEvent.click(screen.getByRole("option", { name: "Travel" }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith("TRX-1", { categoryID: 3, subcategoryID: null });
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit Subcategory" }));
    await screen.findByRole("option", { name: "Travel" });
    expect(optionSpy).toHaveBeenCalledWith("Transactions", "transaction-subcategory", "", "TRX-1", expect.anything());

    patchSpy.mockRejectedValueOnce(new Error("Transaction save failed"));
    fireEvent.click(screen.getByRole("button", { name: "Edit Category" }));
    fireEvent.click(await screen.findAllByRole("option", { name: "Travel" }).then((options) => options[0]));
    expect(await screen.findByRole("alert")).toHaveTextContent("Transaction save failed");
    expect(screen.getByLabelText("Search Category")).toBeInTheDocument();
  });
});
