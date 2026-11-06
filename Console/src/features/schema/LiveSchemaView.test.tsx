import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import { LiveSchemaView } from "./LiveSchemaView";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LiveSchemaView", () => {
  it("registers an eligible existing table as a navigable schema page", async () => {
    vi.spyOn(api, "getLiveSchema").mockResolvedValue({
      databaseName: "isolated.sqlite",
      tableCount: 1,
      tables: [
        {
          name: "FamilyGoals",
          columns: [
            { name: "ID", dataType: "TEXT", nullable: false, primaryKey: true, defaultValue: null },
            { name: "HubID", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
          ],
          foreignKeys: [],
          indexes: [],
        },
      ],
    });
    const schemaPage = {
      name: "FamilyGoals",
      columns: [
        { name: "ID", dataType: "TEXT", nullable: false, primaryKey: true, defaultValue: null },
        { name: "HubID", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
      ],
    };
    const getPages = vi.spyOn(api, "getSchemaPageTables").mockResolvedValueOnce({
      tables: [],
      availableTables: [schemaPage],
    });
    const createPage = vi.spyOn(api, "createSchemaPage").mockImplementation(async () => {
      getPages.mockResolvedValue({
        tables: [schemaPage],
        availableTables: [],
      });
      return {
        name: "FamilyGoals",
        columns: [],
      };
    });
    const onSuccess = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <LiveSchemaView onError={vi.fn()} onSuccess={onSuccess} />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Create page from this table" }));
    await waitFor(() => expect(createPage.mock.calls[0]?.[0]).toBe("FamilyGoals"));
    expect(await screen.findByRole("status")).toHaveTextContent("This table is a schema page in navigation.");
    expect(onSuccess).toHaveBeenCalledWith("FamilyGoals is now available in navigation as a schema page.");
  });
});
