import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
        <MemoryRouter>
          <TransactionsInspector record={record} properties={properties} />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    </TamaguiProvider>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

beforeEach(() => {
  vi.spyOn(api, "getSchemaPageTables").mockResolvedValue({
    tables: [
      {
        name: "BudgetCategories",
        columns: [
          { name: "CategoryID", dataType: "INTEGER", nullable: false, primaryKey: true, defaultValue: null },
          { name: "HubID", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
          { name: "Category", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
          { name: "CategoryType", dataType: "TEXT", nullable: true, primaryKey: false, defaultValue: null },
        ],
      },
      {
        name: "BudgetSubcategories",
        columns: [
          { name: "SubcategoryID", dataType: "INTEGER", nullable: false, primaryKey: true, defaultValue: null },
          { name: "HubID", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
          { name: "CategoryID", dataType: "INTEGER", nullable: false, primaryKey: false, defaultValue: null },
          { name: "Subcategory", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
        ],
      },
    ],
    availableTables: [],
  });
});

afterEach(() => vi.restoreAllMocks());

describe("TransactionsInspector relations and lookups", () => {
  it("exposes relation configuration from the custom Transactions inspector", async () => {
    vi.spyOn(api, "getTablePropertyDefinitions").mockResolvedValue([]);
    vi.spyOn(api, "getTablePropertyValues").mockResolvedValue([]);
    vi.spyOn(api, "getRelatedRecordOptions").mockResolvedValue([{ id: "1", name: "Food" }]);
    const saveSpy = vi.spyOn(api, "saveTablePropertyDefinitions").mockResolvedValue(definitions.slice(0, 2));

    setup();
    fireEvent.click(screen.getByText("Relations and lookups"));

    expect(await screen.findAllByRole("combobox", { name: "Related table" })).toHaveLength(2);
    await waitFor(() => expect(saveSpy).toHaveBeenCalledOnce());
    const saved = saveSpy.mock.calls[0][1];
    const category = saved.find((definition) => definition.sourceColumnName === "CategoryID");
    const subcategory = saved.find((definition) => definition.sourceColumnName === "SubcategoryID");
    expect(category?.id).toMatch(/^transaction-/);
    expect(subcategory?.id).toMatch(/^transaction-/);
    expect(category?.targetTableName).toBe("BudgetCategories");
    expect(subcategory?.targetTableName).toBe("BudgetSubcategories");
    expect(subcategory?.filterByDefinitionID).toBe(category?.id);
  });

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
    expect(categoryLink).toHaveAttribute("href", "/schema/BudgetCategories/record/1");
    expect(screen.queryByRole("link", { name: "—" })).not.toBeInTheDocument();
    expect(await screen.findByText("Variable")).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("link", { name: "Food" }), { pointerType: "touch" });
    fireEvent.pointerDown(screen.getByRole("link", { name: "Food" }), { pointerType: "touch" });
    expect(await screen.findByRole("searchbox", { name: "Search Category records" })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole("searchbox", { name: "Search Category records" })).not.toBeInTheDocument();
    });
    fireEvent.pointerDown(screen.getByRole("link", { name: "Food" }), { pointerType: "touch" });
    fireEvent.pointerDown(screen.getByRole("link", { name: "Food" }), { pointerType: "touch" });
    expect(await screen.findByRole("searchbox", { name: "Search Category records" })).toBeInTheDocument();
    await screen.findByRole("option", { name: "Travel" });
    expect(optionSpy).toHaveBeenCalledWith("Transactions", "transaction-category", "", "TRX-1", expect.anything());
    fireEvent.click(screen.getByRole("option", { name: "Travel" }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith("TRX-1", { categoryID: 3, subcategoryID: null });
    });

    const subcategoryLink = screen
      .getAllByRole("link")
      .find((link) => link.getAttribute("href")?.includes("/BudgetSubcategories/"));
    expect(subcategoryLink).toBeDefined();
    fireEvent.doubleClick(subcategoryLink!);
    await screen.findByRole("option", { name: "Travel" });
    expect(optionSpy).toHaveBeenCalledWith("Transactions", "transaction-subcategory", "", "TRX-1", expect.anything());

    patchSpy.mockRejectedValueOnce(new Error("Transaction save failed"));
    const categoryValueLink = screen
      .getAllByRole("link")
      .find((link) => link.getAttribute("href")?.includes("/BudgetCategories/"));
    expect(categoryValueLink).toBeDefined();
    fireEvent.doubleClick(categoryValueLink!);
    fireEvent.click(await screen.findAllByRole("option", { name: "Travel" }).then((options) => options[0]));
    expect(await screen.findByRole("alert")).toHaveTextContent("Transaction save failed");
    expect(screen.getByRole("searchbox", { name: "Search Category records" })).toBeInTheDocument();
  });

  it("opens lookup source search and navigates to the chosen related record without patching the lookup", async () => {
    vi.spyOn(api, "getTablePropertyDefinitions").mockResolvedValue(definitions);
    vi.spyOn(api, "getTablePropertyValues").mockResolvedValue([
      { definitionID: "transaction-lookup-category-type", recordID: "1", displayValue: "Variable", value: "Variable" },
    ]);
    const optionSpy = vi.spyOn(api, "getRelatedRecordOptions").mockResolvedValue([{ id: "3", name: "Travel" }]);
    const patchSpy = vi.spyOn(api, "patchTransaction");

    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Search lookup source for Category type" }));
    expect(await screen.findByRole("searchbox", { name: "Search records for Category" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("option", { name: "Travel" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/schema/BudgetCategories/record/3");
    });
    expect(optionSpy).toHaveBeenCalledWith("Transactions", "transaction-category", "", "TRX-1", expect.anything());
    expect(patchSpy).not.toHaveBeenCalled();
  });
});
