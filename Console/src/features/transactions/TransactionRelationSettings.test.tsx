import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "@gemsforge/ui";
import { api } from "../../api";
import { TransactionRelationSettings } from "./TransactionRelationSettings";

afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("TransactionRelationSettings", () => {
  it("saves the fixed category relations and a selected computed lookup", async () => {
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
    vi.spyOn(api, "getTablePropertyDefinitions").mockResolvedValue([]);
    const save = vi.spyOn(api, "saveTablePropertyDefinitions").mockImplementation(async (_tableName, input) =>
      input.map((item, sortOrder) => ({
        ...item,
        id: item.id ?? `generated-${sortOrder}`,
        tableName: "Transactions",
        sortOrder,
      })),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <QueryClientProvider client={client}>
          <TransactionRelationSettings />
        </QueryClientProvider>
      </TamaguiProvider>,
    );

    expect(await screen.findByText("Related table: BudgetCategories")).toBeInTheDocument();
    expect(screen.getByText("Related table: BudgetSubcategories")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Lookup property name" }), {
      target: { value: "Category type" },
    });
    fireEvent.click(screen.getByRole("combobox", { name: "Related property" }));
    fireEvent.keyDown(await screen.findByRole("option", { name: "CategoryType" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Add lookup" }));
    fireEvent.click(screen.getByRole("button", { name: "Save relations and lookups" }));

    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    const [, savedDefinitions] = save.mock.calls[0];
    expect(savedDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "transaction-category",
          sourceColumnName: "CategoryID",
          targetTableName: "BudgetCategories",
          targetKeyColumnName: "CategoryID",
          targetDisplayColumnName: "Category",
          kind: "Relation",
        }),
        expect.objectContaining({
          id: "transaction-subcategory",
          sourceColumnName: "SubcategoryID",
          targetTableName: "BudgetSubcategories",
          filterByDefinitionID: "transaction-category",
          targetFilterColumnName: "CategoryID",
        }),
        expect.objectContaining({
          name: "Category type",
          relationDefinitionID: "transaction-category",
          targetColumnName: "CategoryType",
          kind: "Lookup",
        }),
      ]),
    );
  });
});
