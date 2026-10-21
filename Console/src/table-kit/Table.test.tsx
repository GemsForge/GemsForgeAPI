import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("injects accessible New and Import actions and disables them while pending", () => {
    const onNew = vi.fn();
    const onImport = vi.fn();
    render(<Table.Actions onNew={onNew} onImport={onImport} pending />);
    expect(screen.getByRole("button", { name: "New" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
    expect(screen.getByRole("group")).toHaveAttribute("aria-busy", "true");
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
      </Table.Root>,
    );
    screen.getByRole("tab", { name: "List" }).click();
    screen.getByRole("button", { name: "Advance page" }).click();
    expect(onViewChange).toHaveBeenCalledWith("list");
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 1 });
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
