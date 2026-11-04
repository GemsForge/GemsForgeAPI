import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TableImportWorkflow } from "./ImportWorkflow";
import { parseCsv, previewCsv } from "./import";

describe("Table import workflow", () => {
  it("parses quoted delimiters, escaped quotes, CRLF, and embedded newlines", () => {
    expect(parseCsv('Name,Description\r\n"Desk, oak","He said ""hello""\nand left"')).toEqual([
      ["Name", "Description"],
      ["Desk, oak", 'He said "hello"\nand left'],
    ]);
  });

  it("reports malformed quoted CSV with no partial records", () => {
    expect(previewCsv('name\n"unfinished', [{ id: "name" }])).toEqual({
      rows: [],
      errors: [{ row: 0, message: "Unclosed quoted field at row 2" }],
    });
  });

  it("previews and confirms valid CSV records", () => {
    const onConfirm = vi.fn();
    render(
      <TableImportWorkflow
        columns={[{ id: "name" }]}
        validateJson={(value) => value as { name: string }}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Paste CSV" }), { target: { value: "name\nAlex" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByText("1 records ready")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));
    expect(onConfirm).toHaveBeenCalledWith([{ name: "Alex" }]);
  });
});
