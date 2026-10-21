import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TableImportWorkflow } from "./ImportWorkflow";

describe("Table import workflow", () => {
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
