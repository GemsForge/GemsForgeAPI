import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../design-system/tamagui.config";
import { api } from "../api";
import { DatabaseRecordCollection } from "./DatabaseRecordCollection";
import { useRecordUtilities } from "../hooks/useRecordUtilities";
import type { RecordAdapter } from "../table-kit";

interface ExampleRecord {
  id: string;
  name: string;
  status: string;
}

const records: ExampleRecord[] = [
  { id: "one", name: "Alpha", status: "Active" },
  { id: "two", name: "Beta", status: "Paused" },
];

const adapter: RecordAdapter<ExampleRecord> = {
  toTableRecord: (record) => ({
    id: record.id,
    source: record,
    title: record.name,
    status: { label: record.status },
  }),
  getPropertyDefinitions: () => [
    { id: "name", label: "Name", primary: true, getValue: (record) => ({ display: record.name }) },
    { id: "status", label: "Status", getValue: (record) => ({ display: record.status }) },
  ],
};

afterEach(() => vi.restoreAllMocks());

function renderCollection(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">{node}</TamaguiProvider>
    </QueryClientProvider>,
  );
}

function Harness() {
  const utilities = useRecordUtilities(records, (record) => [record.id, record.name, record.status], {});
  return (
    <DatabaseRecordCollection
      label="Examples"
      records={records}
      utilities={utilities}
      adapter={adapter}
      sortOptions={[]}
      filterOptions={["Active", "Paused"]}
      detailId={null}
      onDetailChange={() => undefined}
    />
  );
}

function ActionHarness() {
  const utilities = useRecordUtilities(records, (record) => [record.id, record.name, record.status], {});
  return (
    <DatabaseRecordCollection
      label="Examples"
      records={records}
      utilities={utilities}
      adapter={adapter}
      sortOptions={[]}
      detailId={null}
      onDetailChange={() => undefined}
      actions={{
        onNew: () => undefined,
        newRecordOptions: [{ id: "address", label: "New address", onSelect: () => undefined }],
      }}
    />
  );
}

describe("DatabaseRecordCollection", () => {
  it("uses the filtered result set for the shared Table.Root", () => {
    vi.spyOn(api, "getTableView").mockImplementation(async (_table, viewType) => ({
      view: { viewID: viewType, tableName: "Examples", name: viewType, viewType, workspaceState: null, updatedAt: null },
      columns: [], queries: [],
    }));
    renderCollection(<Harness />);

    expect(screen.getByRole("button", { name: "Open Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Beta" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("radio", { name: "Paused" }));
    expect(screen.queryByRole("button", { name: "Open Alpha" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Beta" })).toBeInTheDocument();
  });

  it("exposes scoped select-all and built-in view switching to the migrated consumer", () => {
    vi.spyOn(api, "getTableView").mockImplementation(async (_table, viewType) => ({
      view: { viewID: viewType, tableName: "Examples", name: viewType, viewType, workspaceState: null, updatedAt: null },
      columns: [], queries: [],
    }));
    renderCollection(<Harness />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(screen.getByRole("checkbox", { name: "Select all" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.getByRole("button", { name: "Table" })).toHaveAttribute("data-state", "on");
  });

  it("keeps view settings available in the table toolbar", () => {
    vi.spyOn(api, "getTableView").mockImplementation(async (_table, viewType) => ({
      view: { viewID: viewType, tableName: "Examples", name: viewType, viewType, workspaceState: null, updatedAt: null },
      columns: [], queries: [],
    }));
    renderCollection(<Harness />);

    const settings = screen.getByRole("button", { name: "View settings" });
    expect(settings).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(settings);
    expect(screen.getByRole("dialog", { name: "View settings" })).toBeInTheDocument();
  });

  it("keeps secondary query controls behind compact icon menus", () => {
    vi.spyOn(api, "getTableView").mockImplementation(async (_table, viewType) => ({
      view: { viewID: viewType, tableName: "Examples", name: viewType, viewType, workspaceState: null, updatedAt: null },
      columns: [], queries: [],
    }));
    renderCollection(<Harness />);

    const sort = screen.getByRole("button", { name: "Sort records" });
    expect(sort).toHaveAttribute("aria-haspopup", "menu");
    expect(sort).toHaveAttribute("type", "button");
  });

  it("passes consumer-owned New Record actions through the collection shell", () => {
    vi.spyOn(api, "getTableView").mockImplementation(async (_table, viewType) => ({
      view: { viewID: viewType, tableName: "Examples", name: viewType, viewType, workspaceState: null, updatedAt: null },
      columns: [], queries: [],
    }));
    renderCollection(<ActionHarness />);

    fireEvent.click(screen.getByRole("button", { name: "New record options" }));
    expect(screen.getByRole("menuitem", { name: "New address" })).toBeInTheDocument();
  });

  it("restores the selected record after saved workspace state loads", async () => {
    const onDetailChange = vi.fn();
    vi.spyOn(api, "getTableView").mockImplementation(async (_table, viewType) => ({
      view: {
        viewID: viewType,
        tableName: "Examples",
        name: viewType,
        viewType,
        workspaceState: viewType === "Gallery" ? JSON.stringify({ activeViewId: "gallery", selectedRecordId: "two" }) : null,
        updatedAt: "2026-11-02T10:00:00Z",
      },
      columns: [], queries: [],
    }));
    renderCollection(<HarnessWithSelection onDetailChange={onDetailChange} />);
    await waitFor(() => expect(onDetailChange).toHaveBeenCalledWith("two"));
  });

  it("persists workspace settings when search changes without changing view or selection", async () => {
    vi.spyOn(api, "getTableView").mockImplementation(async (_table, viewType) => ({
      view: { viewID: viewType, tableName: "Examples", name: viewType, viewType, workspaceState: null, updatedAt: null },
      columns: [], queries: [],
    }));
    const saveWorkspace = vi.spyOn(api, "saveTableViewWorkspaceState").mockResolvedValue({
      viewID: "Gallery", tableName: "Examples", name: "Gallery", viewType: "Gallery", workspaceState: null, updatedAt: null,
    });
    renderCollection(<SearchHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Change search" }));
    await waitFor(() => expect(saveWorkspace).toHaveBeenCalled());
    const savedState = JSON.parse(saveWorkspace.mock.calls.at(-1)![2]);
    expect(savedState.search).toBe("Alpha");
    expect(savedState.activeViewId).toBe("gallery");
    expect(savedState.selectedRecordId).toBeNull();
  });
});

function HarnessWithSelection({ onDetailChange }: { onDetailChange: (id: string | null) => void }) {
  const utilities = useRecordUtilities(records, (record) => [record.id, record.name, record.status], {});
  return <DatabaseRecordCollection label="Examples" records={records} utilities={utilities} adapter={adapter} sortOptions={[]} detailId={null} onDetailChange={onDetailChange} />;
}

function SearchHarness() {
  const utilities = useRecordUtilities(records, (record) => [record.id, record.name, record.status], {});
  return (
    <>
      <button type="button" onClick={() => utilities.onSearch("Alpha")}>Change search</button>
      <DatabaseRecordCollection label="Examples" records={records} utilities={utilities} adapter={adapter} sortOptions={[]} detailId={null} onDetailChange={() => undefined} />
    </>
  );
}
