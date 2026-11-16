import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "@gemsforge/ui";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { api } from "../../api";
import { WireframeSchemaPage } from "./WireframeSchemaPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const columns = [
  { name: "ID", dataType: "TEXT", nullable: false, primaryKey: true, defaultValue: null },
  { name: "HubID", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
  { name: "Title", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
  { name: "RecipeID", dataType: "TEXT", nullable: true, primaryKey: false, defaultValue: null },
  { name: "LegacyID", dataType: "TEXT", nullable: true, primaryKey: false, defaultValue: null },
];
const table = { name: "Ingredients", columns };

function PageHost() {
  return <Outlet context={{ onSuccess: vi.fn() }} />;
}

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<PageHost />}>
              <Route path="/schema/:tableName/*" element={<WireframeSchemaPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </TamaguiProvider>
    </QueryClientProvider>,
  );
}

function setup(
  properties: unknown[],
  values: unknown[],
  rows = [{ ID: "ingredient-1", HubID: "hub-1", Title: "Onion", RecipeID: "recipe-1", LegacyID: "legacy-1" }],
) {
  vi.spyOn(api, "getSchemaPageTables").mockResolvedValue({ tables: [table], availableTables: [] });
  vi.spyOn(api, "getSchemaPageRecords").mockResolvedValue({
    table,
    rows,
    totalCount: rows.length,
    limit: 100,
    offset: 0,
  });
  vi.spyOn(api, "getSchemaPageRecord").mockResolvedValue({
    table,
    row: { ID: "ingredient-1", HubID: "hub-1", Title: "Onion", RecipeID: "recipe-1", LegacyID: "legacy-1" },
  });
  vi.spyOn(api, "getTableColumnDefinitions").mockResolvedValue([]);
  vi.spyOn(api, "getTablePropertyDefinitions").mockResolvedValue(properties as never);
  vi.spyOn(api, "getTablePropertyValues").mockResolvedValue(values as never);
  vi.spyOn(api, "getTablePropertyValuesBatch").mockImplementation(async (_tableName, recordIDs) =>
    Object.fromEntries(recordIDs.map((id, index) => [id, (rows.length > 1 ? [values[index]] : values) as never])),
  );
  vi.spyOn(api, "getTableView").mockRejectedValue(new Error("not configured"));
  vi.spyOn(api, "listRecordPresentations").mockResolvedValue([]);
  vi.spyOn(api, "listRecordBodyExcerpts").mockResolvedValue([]);
  vi.spyOn(api, "listTrash").mockResolvedValue([]);
}

describe("WireframeSchemaPage relation properties", () => {
  it("shows the related display value as a link with Relation type and icon metadata", async () => {
    setup(
      [
        {
          id: "relation-recipes",
          tableName: "Ingredients",
          name: "Recipes",
          kind: "Relation",
          sourceColumnName: "RecipeID",
          targetTableName: "Recipes",
          targetKeyColumnName: "ID",
          targetDisplayColumnName: "Title",
          relationDefinitionID: null,
          targetColumnName: null,
          filterByDefinitionID: null,
          targetFilterColumnName: null,
          sortOrder: 0,
        },
      ],
      [{ definitionID: "relation-recipes", recordID: "recipe-1", displayValue: "Tomato Soup", value: "Tomato Soup" }],
    );
    mount("/schema/Ingredients/record/ingredient-1");
    const link = await screen.findByRole("link", { name: "Tomato Soup" });
    expect(link).toHaveAttribute("href", "/schema/Recipes/record/recipe-1");
    expect(link.closest("dd")).toBeInTheDocument();
    expect(link.closest("dl")?.querySelector('[data-property-id="RecipeID"]')).toHaveAttribute(
      "data-property-type",
      "Relation",
    );
  });

  it("shows a show-original lookup target column value", async () => {
    setup(
      [
        {
          id: "relation-recipes",
          tableName: "Ingredients",
          name: "Recipes",
          kind: "Relation",
          sourceColumnName: "RecipeID",
          targetTableName: "Recipes",
          targetKeyColumnName: "ID",
          targetDisplayColumnName: "Title",
          relationDefinitionID: null,
          targetColumnName: null,
          filterByDefinitionID: null,
          targetFilterColumnName: null,
          sortOrder: 0,
        },
        {
          id: "lookup-prep",
          tableName: "Ingredients",
          name: "Prep time",
          kind: "Lookup",
          sourceColumnName: null,
          targetTableName: null,
          targetKeyColumnName: null,
          targetDisplayColumnName: null,
          relationDefinitionID: "relation-recipes",
          targetColumnName: "PrepTime",
          filterByDefinitionID: null,
          targetFilterColumnName: null,
          sortOrder: 1,
        },
      ],
      [
        { definitionID: "relation-recipes", recordID: "recipe-1", displayValue: "Tomato Soup", value: "Tomato Soup" },
        { definitionID: "lookup-prep", recordID: "recipe-1", displayValue: "25 minutes", value: "25 minutes" },
      ],
    );
    mount("/schema/Ingredients/record/ingredient-1");
    expect(await screen.findByText("25 minutes")).toBeInTheDocument();
    expect(screen.getByText("Prep time").closest("dt")).toHaveAttribute("data-property-type", "Lookup");
  });

  it("preserves the raw display for columns without a property definition", async () => {
    setup([], []);
    mount("/schema/Ingredients/record/ingredient-1");
    expect(await screen.findByText("legacy-1")).toBeInTheDocument();
    expect(document.querySelector('[data-property-id="LegacyID"]')).toHaveAttribute("data-property-type", "Text");
  });

  it("loads relation values for the collection with one batch request for its page", async () => {
    const rows = [
      { ID: "ingredient-1", HubID: "hub-1", Title: "Onion", RecipeID: "recipe-1", LegacyID: "legacy-1" },
      { ID: "ingredient-2", HubID: "hub-1", Title: "Basil", RecipeID: "recipe-2", LegacyID: "legacy-2" },
      { ID: "ingredient-3", HubID: "hub-1", Title: "Garlic", RecipeID: "recipe-3", LegacyID: "legacy-3" },
    ];
    const relationValues = [
      { definitionID: "relation-recipes", recordID: "recipe-1", displayValue: "Tomato Soup", value: "Tomato Soup" },
      { definitionID: "relation-recipes", recordID: "recipe-2", displayValue: "Pesto", value: "Pesto" },
      { definitionID: "relation-recipes", recordID: "recipe-3", displayValue: "Garlic Bread", value: "Garlic Bread" },
    ];
    setup(
      [
        {
          id: "relation-recipes",
          tableName: "Ingredients",
          name: "Recipes",
          kind: "Relation",
          sourceColumnName: "RecipeID",
          targetTableName: "Recipes",
          targetKeyColumnName: "ID",
          targetDisplayColumnName: "Title",
          relationDefinitionID: null,
          targetColumnName: null,
          filterByDefinitionID: null,
          targetFilterColumnName: null,
          sortOrder: 0,
        },
      ],
      relationValues,
      rows,
    );
    mount("/schema/Ingredients");
    fireEvent.click(await screen.findByRole("tab", { name: "Table view" }));
    await screen.findByText("Onion");
    expect(api.getTablePropertyValuesBatch).toHaveBeenCalledTimes(1);
    expect(api.getTablePropertyValuesBatch).toHaveBeenCalledWith(
      "Ingredients",
      ["ingredient-1", "ingredient-2", "ingredient-3"],
      expect.anything(),
    );
    expect(api.getTablePropertyValues).not.toHaveBeenCalled();
    const tomato = await screen.findByRole("link", { name: "Tomato Soup" });
    const pesto = screen.getByRole("link", { name: "Pesto" });
    const garlicBread = screen.getByRole("link", { name: "Garlic Bread" });
    expect(tomato).toHaveAttribute("href", "/schema/Recipes/record/recipe-1");
    expect(pesto).toHaveAttribute("href", "/schema/Recipes/record/recipe-2");
    expect(garlicBread).toHaveAttribute("href", "/schema/Recipes/record/recipe-3");
  });

  it("shows a relation's display value as a gallery card subtitle", async () => {
    setup(
      [
        {
          id: "relation-recipes",
          tableName: "Ingredients",
          name: "Recipes",
          kind: "Relation",
          sourceColumnName: "RecipeID",
          targetTableName: "Recipes",
          targetKeyColumnName: "ID",
          targetDisplayColumnName: "Title",
          relationDefinitionID: null,
          targetColumnName: null,
          filterByDefinitionID: null,
          targetFilterColumnName: null,
          sortOrder: 0,
        },
      ],
      [{ definitionID: "relation-recipes", recordID: "recipe-1", displayValue: "Tomato Soup", value: "Tomato Soup" }],
    );
    mount("/schema/Ingredients");
    expect(await screen.findByText("Tomato Soup")).toBeInTheDocument();
    expect(screen.queryByText("recipe-1")).not.toBeInTheDocument();
  });
});
