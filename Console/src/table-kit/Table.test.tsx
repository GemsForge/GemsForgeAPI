import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Table } from "./index";

interface Row { id: string; name: string; }
const columns = [{ id: "name", header: "Name", cell: (row: Row) => row.name }];
const rows = [{ id: "one", name: "One" }, { id: "two", name: "Two" }];

describe("Table Kit", () => {
  it("composes the scoped table primitives with typed rows", () => {
    render(<Table.Root<Row> rows={rows} columns={columns} rowKey={(row) => row.id} caption="Records">
      <Table.Header><h1>Records</h1></Table.Header><Table.Content /><Table.Pagination />
    </Table.Root>);
    expect(screen.getByRole("heading", { name: "Records" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "One" })).toBeInTheDocument();
  });

  it("supports controlled view and pagination boundaries", () => {
    const onViewChange = vi.fn();
    const onPaginationChange = vi.fn();
    render(<Table.Root<Row> rows={rows} columns={columns} rowKey={(row) => row.id} views={[{ id: "grid", label: "Grid" }, { id: "list", label: "List" }]} viewId="grid" onViewChange={onViewChange} pagination={{ pageIndex: 0, pageSize: 1, total: 2 }} onPaginationChange={onPaginationChange}>
      <Table.Views /><Table.Pagination />
    </Table.Root>);
    screen.getByRole("tab", { name: "List" }).click();
    screen.getByRole("button", { name: "Next" }).click();
    expect(onViewChange).toHaveBeenCalledWith("list");
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 1, total: 2 });
  });

  it("throws when a compound component is outside Root", () => {
    expect(() => render(<Table.Content />)).toThrow("Table Kit components must be rendered inside Table.Root");
  });
});
