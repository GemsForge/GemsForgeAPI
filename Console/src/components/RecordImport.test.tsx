import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TamaguiProvider } from "tamagui";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { tamaguiConfig } from "@gemsforge/ui";
import { RecordImport } from "./RecordImport";

afterEach(() => vi.restoreAllMocks());

const table = {
  name: "FamilyGoals",
  columns: [
    { name: "ID", dataType: "TEXT", nullable: false, primaryKey: true, defaultValue: null },
    { name: "HubID", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
    { name: "Title", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
    { name: "Quantity", dataType: "INTEGER", nullable: false, primaryKey: false, defaultValue: null },
  ],
};

function renderImport() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {children}
      </TamaguiProvider>
    </QueryClientProvider>
  );
  return render(<RecordImport label="FamilyGoals" expectedColumns={[]} mode="paste" open schemaTable={table} />, {
    wrapper,
  });
}

describe("schema-backed RecordImport", () => {
  it("maps pasted JSON, validates it on the server, and confirms the import", async () => {
    vi.spyOn(api, "previewTableCSVImport").mockResolvedValue({
      table: "FamilyGoals",
      columns: table.columns,
      headers: ["Name", "Count"],
      rows: [{ rowNumber: 2, values: { Name: "Travel", Count: "2" }, errors: [] }],
      confirmationToken: "token",
      expiresAt: "2099-01-01T00:00:00Z",
      readyToImport: true,
    });
    const commit = vi.spyOn(api, "commitTableCSVImport").mockResolvedValue({
      table: "FamilyGoals",
      importedCount: 1,
      status: "imported",
    });
    renderImport();

    fireEvent.change(screen.getByRole("textbox", { name: "FamilyGoals CSV or JSON" }), {
      target: { value: '[{"Name":"Travel","Count":2}]' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Map fields" }));
    expect(await screen.findByRole("group", { name: "Map import fields to FamilyGoals" })).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    fireEvent.change(screen.getAllByRole("combobox")[0]!, { target: { value: "Title" } });
    fireEvent.change(screen.getAllByRole("combobox")[1]!, { target: { value: "Quantity" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview and validate" }));
    await screen.findByText(/ready to import/);
    expect(vi.mocked(api.previewTableCSVImport).mock.calls[0]?.[0]).toEqual({
      table: "FamilyGoals",
      csv: "Name,Count\nTravel,2",
      mapping: { Name: "Title", Count: "Quantity" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm and import" }));
    await waitFor(() => expect(commit.mock.calls[0]?.[0]).toBe("token"));
    expect(await screen.findByRole("status")).toHaveTextContent("Imported 1 records into FamilyGoals.");
  });
});
