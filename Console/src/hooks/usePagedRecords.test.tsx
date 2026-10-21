import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePagedRecords } from "./usePagedRecords";
import { GemDataTable } from "../components/ui/GemDataTable--LEGACY";
afterEach(cleanup);
describe("bounded large-list rendering", () => {
  it("only selects one page from 10,000 records and clamps shrinking data", () => {
    const records = Array.from({ length: 10_000 }, (_, index) => index);
    const hook = renderHook(({ rows }) => usePagedRecords(rows), { initialProps: { rows: records } });
    expect(hook.result.current.items).toHaveLength(50);
    expect(hook.result.current.pageCount).toBe(200);
    act(() => hook.result.current.next());
    expect(hook.result.current.items[0]).toBe(50);
    hook.rerender({ rows: [1] });
    expect(hook.result.current.page).toBe(0);
    expect(hook.result.current.items).toEqual([1]);
  });
  it("renders only 50 of 1000 table rows and exposes keyboard-friendly paging", () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({ id: `Record ${index}` }));
    render(
      <GemDataTable
        caption="Large fixture"
        rows={rows}
        columns={[{ key: "id", label: "Record", render: (row) => row.id }]}
        rowKey={(row) => row.id}
      />,
    );
    expect(screen.getAllByRole("row")).toHaveLength(51);
    expect(screen.getByRole("cell", { name: "Record 0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page of Large fixture" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next page of Large fixture" }));
    expect(screen.queryByRole("cell", { name: "Record 0" })).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Record 50" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("51–100 of 1000");
  });
  it("does not add paging UI for an empty or small table", () => {
    render(<GemDataTable caption="Empty fixture" rows={[]} columns={[]} rowKey={() => ""} />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
