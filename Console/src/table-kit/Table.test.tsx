import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../design-system/tamagui.config";
import { CreateFormFrame } from "../components/forms/CreateForm";
import { Table, useTableContext } from "./index";

interface Row {
  id: string;
  name: string;
}
const columns = [{ id: "name", header: "Name", cell: (row: Row) => row.name }];
const rows = [
  { id: "one", name: "One" },
  { id: "two", name: "Two" },
];

function renderActions(actions: ReactNode) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      {actions}
    </TamaguiProvider>,
  );
}

function PaginationHarness() {
  const { pagination, setPagination } = useTableContext<Row>();
  return (
    <button
      type="button"
      onClick={() =>
        setPagination({ pageIndex: (pagination?.pageIndex ?? 0) + 1, pageSize: pagination?.pageSize ?? 1 })
      }
    >
      Advance page
    </button>
  );
}

function StateHarness() {
  const { viewId, pagination } = useTableContext<Row>();
  return <output>{`${viewId ?? "none"}:${pagination?.pageIndex ?? "none"}`}</output>;
}

function SelectionPagingHarness() {
  const [pageIndex, setPageIndex] = useState(0);
  const pageRows = [rows[pageIndex]];
  return (
    <Table.Root<Row>
      rows={pageRows}
      columns={columns}
      rowKey={(row) => row.id}
      selection={{ matchingIds: rows.map((row) => row.id) }}
    >
      <Table.Selection />
      <button type="button" onClick={() => setPageIndex(1)}>
        Next page
      </button>
    </Table.Root>
  );
}

describe("Table Kit", () => {
  it("exposes shared query controls with reset and filter semantics", () => {
    const onStateChange = vi.fn();
    render(
      <Table.QueryControls
        state={{ search: "old", filters: {}, sort: [], pageIndex: 2, pageSize: 25 }}
        onStateChange={onStateChange}
        filters={[{ id: "status", label: "Status", options: [{ value: "open", label: "Open" }] }]}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "new" } });
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ search: "new", pageIndex: 0 }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onStateChange).toHaveBeenLastCalledWith({ search: "", filters: {}, sort: [], pageIndex: 0, pageSize: 25 });
  });

  it("combines New and Import actions behind the compact trigger while pending", () => {
    const onNew = vi.fn();
    const onImport = vi.fn();
    renderActions(<Table.Actions onNew={onNew} onImport={onImport} pending />);
    expect(screen.getByRole("button", { name: "New record options" })).toBeDisabled();
    expect(screen.getByRole("group")).toHaveAttribute("aria-busy", "true");
  });

  it("opens New and Import operations from the plus utility", () => {
    const onNew = vi.fn();
    const onImport = vi.fn();
    renderActions(<Table.Actions onNew={onNew} onImport={onImport} />);

    fireEvent.click(screen.getByRole("button", { name: "New record options" }));
    expect(screen.getByRole("menuitem", { name: "New" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Import" }));
    expect(onImport).toHaveBeenCalledOnce();
  });

  it("exposes separate file and paste import menu entry points", () => {
    const onImportFile = vi.fn();
    const onPasteCsv = vi.fn();
    const onPasteJson = vi.fn();
    renderActions(<Table.Actions onImportFile={onImportFile} onPasteCsv={onPasteCsv} onPasteJson={onPasteJson} />);
    fireEvent.click(screen.getByRole("button", { name: "Import options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Paste CSV" }));
    expect(onPasteCsv).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Import options" }));
    expect(screen.getByRole("menuitem", { name: "Import file" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Paste JSON" })).toBeInTheDocument();
  });

  it("combines typed create and intake actions in a keyboard-navigable menu", () => {
    const onNew = vi.fn();
    const onAddress = vi.fn();
    const onPaste = vi.fn();
    renderActions(
      <Table.Actions
        onNew={onNew}
        newRecordOptions={[{ id: "address", label: "New address", onSelect: onAddress }]}
        onPasteCsv={onPaste}
      />,
    );

    const trigger = screen.getByRole("button", { name: "New record options" });
    fireEvent.click(trigger);
    const defaultNew = screen.getByRole("menuitem", { name: "New" });
    expect(defaultNew).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    const address = screen.getByRole("menuitem", { name: "New address" });
    expect(address).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Paste CSV" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "New address" }));
    expect(onAddress).toHaveBeenCalledOnce();
  });

  it("opens the New Record utility, switches workflows, and restores focus on close", () => {
    renderActions(
      <Table.Actions
        newRecordUtility={{
          options: [
            {
              id: "create",
              label: "New record",
              description: "Open the create form.",
              render: ({ close }) => (
                <button type="button" onClick={close}>
                  Create workflow
                </button>
              ),
            },
            {
              id: "import",
              label: "Import file",
              description: "Choose a file.",
              render: () => <p>Import workflow</p>,
            },
            {
              id: "paste",
              label: "Paste data",
              description: "Paste records.",
              render: () => <p>Paste workflow</p>,
            },
          ],
        }}
      />,
    );

    const trigger = screen.getByRole("button", { name: "New record" });
    fireEvent.click(trigger);
    // JSDOM treats content inside Tamagui's native dialog portal as hidden.
    expect(screen.getByRole("dialog", { name: "New record", hidden: true })).toBeInTheDocument();
    expect(screen.getByText("Create workflow")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "New record", hidden: true })).toHaveTextContent("Open the create form.");
    expect(screen.queryByText("Choose an operation.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Import file/, hidden: true }));
    expect(screen.getByText("Import workflow")).toBeInTheDocument();
    expect(screen.queryByText("Create workflow")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "New record", hidden: true })).toHaveTextContent("Choose a file.");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "New record", hidden: true })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close new record utility", hidden: true }));
    expect(trigger).toHaveFocus();
  });

  it("keeps the create form submit button inside the New Record dialog", () => {
    const onSubmit = vi.fn();
    renderActions(
      <Table.Actions
        newRecordUtility={{
          options: [
            {
              id: "create",
              label: "Input Form",
              render: ({ close }) => (
                <CreateFormFrame
                  title="Create address"
                  submitting={false}
                  error={null}
                  onCancel={close}
                  onSubmit={onSubmit}
                >
                  <input aria-label="Street" />
                </CreateFormFrame>
              ),
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New record" }));
    const dialog = screen.getByRole("dialog", { name: "New record", hidden: true });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create record", hidden: true }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("composes the scoped table primitives with typed rows", () => {
    render(
      <Table.Root<Row> rows={rows} columns={columns} rowKey={(row) => row.id} caption="Records">
        <Table.Header>
          <h1>Records</h1>
        </Table.Header>
        <Table.Content />
        <Table.Pagination />
      </Table.Root>,
    );
    expect(screen.getByRole("heading", { name: "Records" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Table content" })).toBeInTheDocument();
  });

  it("supports controlled view and pagination boundaries", () => {
    const onViewChange = vi.fn();
    const onPaginationChange = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <Table.Root<Row>
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          views={[
            { id: "grid", label: "Grid" },
            { id: "list", label: "List" },
          ]}
          viewId="grid"
          onViewChange={onViewChange}
          pagination={{ pageIndex: 0, pageSize: 1, total: 2 }}
          onPaginationChange={onPaginationChange}
        >
          <Table.Views />
          <Table.Pagination>
            <PaginationHarness />
          </Table.Pagination>
        </Table.Root>
      </TamaguiProvider>,
    );
    screen.getByRole("button", { name: "List" }).click();
    screen.getByRole("button", { name: "Advance page" }).click();
    expect(onViewChange).toHaveBeenCalledWith("list");
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 1 });
  });

  it("coordinates current-page and clear selection in the scoped context", () => {
    const onSelectionChange = vi.fn();
    render(
      <Table.Root<Row>
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        selection={{ matchingIds: ["one", "two", "three"], onSelectionChange }}
      >
        <Table.Selection />
      </Table.Root>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["one", "two"]));
    expect(screen.queryByRole("button", { name: "Select all matching" })).not.toBeInTheDocument();
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set());
  });

  it("exposes an indeterminate state for partial current-page selection", () => {
    render(
      <Table.Root<Row>
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        selection={{ defaultSelectedIds: ["one"], matchingIds: ["one", "two", "three"] }}
      >
        <Table.Selection />
      </Table.Root>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Select all" });
    expect(checkbox).not.toBeChecked();
    expect((checkbox as HTMLInputElement).indeterminate).toBe(true);
    expect(checkbox).toHaveAttribute("aria-checked", "mixed");
    expect(screen.queryByRole("button", { name: "Select all matching" })).not.toBeInTheDocument();
  });

  it("preserves selected IDs across page updates while applying current-page toggles", () => {
    render(<SelectionPagingHarness />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByRole("status")).toHaveTextContent("1 selected");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 selected");
  });

  it("excludes disabled current-page records from bulk selection", () => {
    const onSelectionChange = vi.fn();
    render(
      <Table.Root<Row>
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        selection={{ isSelectable: (row) => row.id === "one", onSelectionChange }}
      >
        <Table.Selection />
      </Table.Root>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["one"]));
  });

  it("keeps selection isolated between Table.Root instances", () => {
    render(
      <>
        <Table.Root<Row> rows={rows} columns={columns} rowKey={(row) => row.id}>
          <Table.Selection />
        </Table.Root>
        <Table.Root<Row> rows={rows} columns={columns} rowKey={(row) => row.id}>
          <Table.Selection />
        </Table.Root>
      </>,
    );

    const checkboxes = screen.getAllByRole("checkbox", { name: "Select all" });
    fireEvent.click(checkboxes[0]);

    expect(screen.getAllByRole("status").map((status) => status.textContent)).toEqual(["2 selected", "0 selected"]);
  });

  it("throws when a compound component is outside Root", () => {
    expect(() => render(<Table.Content />)).toThrow("Table Kit components must be rendered inside Table.Root");
  });

  it("keeps uncontrolled state scoped to each Root", () => {
    render(
      <>
        <Table.Root<Row>
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          views={[{ id: "first", label: "First" }]}
          defaultViewId="first"
          defaultPagination={{ pageIndex: 2, pageSize: 10 }}
        >
          <StateHarness />
        </Table.Root>
        <Table.Root<Row>
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          views={[{ id: "second", label: "Second" }]}
          defaultViewId="second"
        >
          <StateHarness />
        </Table.Root>
      </>,
    );

    expect(screen.getAllByText("first:2")).toHaveLength(1);
    expect(screen.getAllByText("second:0")).toHaveLength(1);
  });

  it("supports a configurable collapsible header description", () => {
    render(
      <Table.Root<Row> rows={rows} columns={columns} rowKey={(row) => row.id}>
        <Table.Header title="Records" description="Helpful context" collapsibleDescription />
      </Table.Root>,
    );
    expect(screen.getByText("Helpful context")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide description" }));
    expect(screen.queryByText("Helpful context")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show description" }));
    expect(screen.getByText("Helpful context")).toBeInTheDocument();
  });

  it("exposes semantic header subcomponents", () => {
    render(
      <Table.Root<Row> rows={rows} columns={columns} rowKey={(row) => row.id}>
        <Table.Header>
          <Table.Header.Title>Records</Table.Header.Title>
          <Table.Header.Description>Helpful context</Table.Header.Description>
          <Table.Header.Metadata>
            <dt>Count</dt>
            <dd>2</dd>
          </Table.Header.Metadata>
        </Table.Header>
      </Table.Root>,
    );

    expect(screen.getByRole("heading", { name: "Records" })).toBeInTheDocument();
    expect(screen.getByText("Helpful context")).toBeInTheDocument();
    expect(screen.getByText("Count")).toBeInTheDocument();
  });
});
