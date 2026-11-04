import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TamaguiProvider } from "tamagui";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { tamaguiConfig } from "../design-system/tamagui.config";
import { ensureTableCSVImportOption, TableCSVImportWorkflow } from "./TableCSVImportWorkflow";

afterEach(() => vi.restoreAllMocks());

function renderWorkflow(onComplete = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        {children}
      </TamaguiProvider>
    </QueryClientProvider>
  );
  return render(<TableCSVImportWorkflow onComplete={onComplete} onCancel={vi.fn()} />, { wrapper });
}

const availableTables = {
  tables: [
    {
      name: "CustomInventory",
      columns: [
        { name: "ID", dataType: "INTEGER", nullable: false, primaryKey: true, defaultValue: null },
        { name: "HubID", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
        { name: "Name", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
        { name: "Quantity", dataType: "INTEGER", nullable: false, primaryKey: false, defaultValue: null },
      ],
    },
  ],
};
const validPreview = {
  table: "CustomInventory",
  columns: availableTables.tables[0]!.columns,
  headers: ["Name", "Quantity"],
  rows: [{ rowNumber: 2, values: { Name: "Desk", Quantity: "1" }, errors: [] }],
  confirmationToken: "one-use-token",
  expiresAt: "2099-01-01T00:00:00.000Z",
  readyToImport: true,
};

describe("Table CSV import workflow", () => {
  it("adds the shared import option once and preserves existing consumer options", () => {
    const consumerOption = { id: "manual", label: "Manual", render: () => null };
    const options = [consumerOption];
    const withImporter = ensureTableCSVImportOption(options);

    expect(withImporter.map((option) => option.id)).toEqual(["manual", "table-csv-import"]);
    expect(withImporter[0]).toBe(consumerOption);
    expect(ensureTableCSVImportOption(withImporter)).toBe(withImporter);
  });

  it("suggests property matches, previews, confirms, and reports the imported table", async () => {
    vi.spyOn(api, "getImportableSQLTables").mockResolvedValue(availableTables);
    const preview = vi.spyOn(api, "previewTableCSVImport").mockResolvedValue(validPreview);
    const commit = vi.spyOn(api, "commitTableCSVImport").mockResolvedValue({
      table: "CustomInventory",
      importedCount: 1,
      status: "imported",
    });
    const onComplete = vi.fn();
    renderWorkflow(onComplete);

    fireEvent.change(await screen.findByRole("combobox", { name: "Target table" }), {
      target: { value: "CustomInventory" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Paste CSV" }), {
      target: { value: "Name,Quantity\nDesk,1" },
    });
    await waitFor(() => expect(screen.getAllByRole("combobox")).toHaveLength(3));
    expect((screen.getAllByRole("combobox")[1] as HTMLSelectElement).value).toBe("Name");
    expect((screen.getAllByRole("combobox")[2] as HTMLSelectElement).value).toBe("Quantity");

    fireEvent.click(screen.getByRole("button", { name: "Preview import" }));
    await screen.findByText(/1 rows · ready to import/);
    expect(preview.mock.calls[0]?.[0]).toEqual({
      table: "CustomInventory",
      csv: "Name,Quantity\nDesk,1",
      mapping: { Name: "Name", Quantity: "Quantity" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm and import" }));
    await screen.findByText("Imported 1 records into CustomInventory.");
    expect(commit.mock.calls[0]?.[0]).toBe("one-use-token");
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("shows server row errors and keeps invalid previews from being confirmed", async () => {
    vi.spyOn(api, "getImportableSQLTables").mockResolvedValue(availableTables);
    vi.spyOn(api, "previewTableCSVImport").mockResolvedValue({
      ...validPreview,
      rows: [
        {
          rowNumber: 3,
          values: { Name: "Desk", Quantity: "not-a-number" },
          errors: ["Quantity must be a valid INTEGER value."],
        },
      ],
      confirmationToken: null,
      expiresAt: null,
      readyToImport: false,
    });
    const commit = vi.spyOn(api, "commitTableCSVImport");
    renderWorkflow();

    fireEvent.change(await screen.findByRole("combobox", { name: "Target table" }), {
      target: { value: "CustomInventory" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Paste CSV" }), {
      target: { value: "Name,Quantity\nDesk,not-a-number" },
    });
    await waitFor(() => expect(screen.getAllByRole("combobox")).toHaveLength(3));
    fireEvent.click(screen.getByRole("button", { name: "Preview import" }));

    expect(await screen.findByText(/fix the listed errors before importing/)).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "3" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Desk" })).toBeInTheDocument();
    expect(screen.getByText("Quantity must be a valid INTEGER value.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm and import" })).toBeDisabled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("keeps failure visible and does not report success when commit fails", async () => {
    vi.spyOn(api, "getImportableSQLTables").mockResolvedValue(availableTables);
    const preview = vi.spyOn(api, "previewTableCSVImport").mockResolvedValue(validPreview);
    vi.spyOn(api, "commitTableCSVImport").mockRejectedValue(new Error("Constraint conflict"));
    renderWorkflow();

    fireEvent.change(await screen.findByRole("combobox", { name: "Target table" }), {
      target: { value: "CustomInventory" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Paste CSV" }), {
      target: { value: "Name,Quantity\nDesk,1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview import" }));
    await screen.findByText(/1 rows · ready to import/);
    fireEvent.click(screen.getByRole("button", { name: "Confirm and import" }));

    expect(await screen.findByText(/Constraint conflict/)).toBeInTheDocument();
    expect(screen.queryByText(/Imported .* records into/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview import" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Confirm and import" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Preview import" }));
    await waitFor(() => expect(preview).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm and import" })).toBeEnabled());
  });

  it("locks the table, CSV, and mapping controls while previewing", async () => {
    vi.spyOn(api, "getImportableSQLTables").mockResolvedValue(availableTables);
    let finishPreview: ((value: typeof validPreview) => void) | undefined;
    vi.spyOn(api, "previewTableCSVImport").mockImplementation(
      () => new Promise((resolve) => (finishPreview = resolve)),
    );
    renderWorkflow();

    fireEvent.change(await screen.findByRole("combobox", { name: "Target table" }), {
      target: { value: "CustomInventory" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Paste CSV" }), {
      target: { value: "Name,Quantity\nDesk,1" },
    });
    await waitFor(() => expect(screen.getAllByRole("combobox")).toHaveLength(3));
    fireEvent.click(screen.getByRole("button", { name: "Preview import" }));

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Import CSV into SQL table" })).toHaveAttribute("aria-busy", "true"),
    );
    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    screen.getAllByRole("combobox").forEach((control) => expect(control).toBeDisabled());
    expect(screen.getByRole("textbox", { name: "Paste CSV" })).toBeDisabled();
    expect(screen.getByLabelText("Choose CSV file")).toBeDisabled();

    finishPreview?.(validPreview);
    await screen.findByText(/1 rows · ready to import/);
  });
});
