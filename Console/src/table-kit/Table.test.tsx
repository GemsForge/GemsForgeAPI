import { render, screen } from "@testing-library/react";
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
});
