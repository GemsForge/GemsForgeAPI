import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { APIError } from "../api";
import { EditableRecordFields, formatRecordDate } from "./EditableRecordFields";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../design-system";

function renderFields(fields: ComponentProps<typeof EditableRecordFields>["fields"]) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <EditableRecordFields fields={fields} />
    </TamaguiProvider>,
  );
}

describe("EditableRecordFields", () => {
  it("formats date-only values without shifting the calendar day", () => {
    expect(formatRecordDate("08May2022")).toBe("08May2022");
    expect(formatRecordDate("2022-05-08")).toBe("08May2022");
    expect(formatRecordDate(null)).toBe("Not recorded");
  });

  it("renders server-owned values read-only and editable values using their declared input type", () => {
    renderFields([
      { label: "Address line 1", value: "3283 Boring Rd", onSave: vi.fn() },
      { label: "Address ID", value: "ADDR-1", readOnlyReason: "Primary key" },
      { label: "Address line 2", value: undefined },
      { label: "Last updated", value: "2026-10-18T12:00:00Z", readOnlyReason: "Server managed" },
    ]);

    expect(screen.getByText("3283 Boring Rd")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit address line 1" })).toBeInTheDocument();
    expect(screen.getByText("ADDR-1").parentElement).toHaveTextContent("Primary key");
    expect(screen.getByText("Address line 2").parentElement).toHaveTextContent("—");
    expect(screen.getByText("2026-10-18T12:00:00Z").parentElement).toHaveTextContent("Server managed");
    expect(screen.queryByRole("button", { name: "Edit address id" })).not.toBeInTheDocument();
  });

  it("saves typed values, sends null for clearing nullable values, and retains errors for correction", async () => {
    const saveNumber = vi.fn().mockResolvedValue(undefined);
    const saveNullable = vi.fn().mockRejectedValueOnce(new APIError("Invalid value", 422)).mockResolvedValue(undefined);
    renderFields([
      { label: "Monthly amount", value: 80, inputType: "number", onSave: saveNumber },
      { label: "Notes", value: "Old note", nullable: true, onSave: saveNullable },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Edit monthly amount" }));
    fireEvent.change(screen.getByLabelText("Monthly amount"), { target: { value: "95.5" } });
    fireEvent.submit(screen.getByLabelText("Monthly amount").closest("form")!);
    await waitFor(() => expect(saveNumber).toHaveBeenCalledWith(95.5));

    fireEvent.click(screen.getByRole("button", { name: "Edit notes" }));
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Corrected note" } });
    fireEvent.submit(screen.getByLabelText("Notes").closest("form")!);
    expect(
      await screen.findByText("Some information is invalid. Review the fields and try again."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toHaveValue("Corrected note");
    fireEvent.click(screen.getByText("Clear value"));
    fireEvent.submit(screen.getByLabelText("Notes").closest("form")!);
    await waitFor(() => expect(saveNullable).toHaveBeenLastCalledWith(null));
  });

  it("handles booleans and controlled select values", async () => {
    const saveBoolean = vi.fn().mockResolvedValue(undefined);
    const saveStatus = vi.fn().mockResolvedValue(undefined);
    renderFields([
      { label: "First receipt item", value: false, inputType: "boolean", onSave: saveBoolean },
      {
        label: "Status",
        value: "Current",
        inputType: "select",
        options: [
          { label: "Current", value: "Current" },
          { label: "Former", value: "Former" },
        ],
        onSave: saveStatus,
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Edit first receipt item" }));
    fireEvent.click(screen.getByLabelText("First receipt item"));
    fireEvent.submit(screen.getByLabelText("First receipt item").closest("form")!);
    await waitFor(() => expect(saveBoolean).toHaveBeenCalledWith(true));

    fireEvent.click(screen.getByRole("button", { name: "Edit status" }));
    // Tamagui's select is a combobox; changing its button value does not select an item.
    const statusSelect = document.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(statusSelect);
    fireEvent.keyDown(screen.getByRole("option", { name: "Former" }), { key: "Enter" });
    fireEvent.submit(statusSelect.closest("form")!);
    await waitFor(() => expect(saveStatus).toHaveBeenCalledWith("Former"));
  });
});
