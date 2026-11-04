import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "@gemsforge/ui";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APIError, api } from "../../api";
import { SchemaTablePage } from "./SchemaTablePage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SchemaTablePage", () => {
  it("opens Hub-scoped records in Table Kit and restores the saved inspector selection", async () => {
    const columns = [
      { name: "ID", dataType: "TEXT", nullable: false, primaryKey: true, defaultValue: null },
      { name: "HubID", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
      { name: "Goal", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
    ];
    vi.spyOn(api, "getSchemaPageTables").mockResolvedValue({
      tables: [{ name: "FamilyGoals", columns }],
      availableTables: [],
    });
    vi.spyOn(api, "getSchemaPageRecords").mockResolvedValue({
      table: { name: "FamilyGoals", columns },
      rows: [{ ID: "goal-1", HubID: "hub-a", Goal: "Read together" }],
      totalCount: 1,
      limit: 100,
      offset: 0,
    });
    vi.spyOn(api, "getTableView").mockImplementation(async (_table, viewType) => ({
      view: {
        viewID: viewType,
        tableName: "FamilyGoals",
        name: viewType,
        viewType,
        workspaceState:
          viewType === "Gallery" ? JSON.stringify({ activeViewId: "gallery", selectedRecordId: "goal-1" }) : null,
        updatedAt: "2026-11-04T10:00:00Z",
      },
      columns: [],
      queries: [],
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
          <MemoryRouter initialEntries={["/schema/FamilyGoals"]}>
            <Routes>
              <Route path="/schema/:tableName" element={<SchemaTablePage />} />
            </Routes>
          </MemoryRouter>
        </TamaguiProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "FamilyGoals" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Goal")).toBeInTheDocument());
    expect(screen.getAllByText("Read together").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Records from your Hub in the configured live database.")).toBeInTheDocument();
  });

  it("keeps Table Kit view controls available and explains an empty schema page", async () => {
    const columns = [
      { name: "ID", dataType: "TEXT", nullable: false, primaryKey: true, defaultValue: null },
      { name: "HubID", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
      { name: "Goal", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
    ];
    vi.spyOn(api, "getSchemaPageTables").mockResolvedValue({
      tables: [{ name: "FamilyGoals", columns }],
      availableTables: [],
    });
    vi.spyOn(api, "getSchemaPageRecords").mockResolvedValue({
      table: { name: "FamilyGoals", columns },
      rows: [],
      totalCount: 0,
      limit: 100,
      offset: 0,
    });
    vi.spyOn(api, "getTableView").mockRejectedValue(new APIError("Not found", 404));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
          <MemoryRouter initialEntries={["/schema/FamilyGoals"]}>
            <Routes>
              <Route path="/schema/:tableName" element={<SchemaTablePage />} />
            </Routes>
          </MemoryRouter>
        </TamaguiProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("No FamilyGoals records yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "List" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gallery" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Table" })).toBeInTheDocument();
  });
});
