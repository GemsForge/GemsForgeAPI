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
    expect(screen.getByRole("button", { name: "Address line 1: 3283 Boring Rd" })).toBeInTheDocument();
    expect(screen.getByText("ADDR-1").parentElement).toHaveTextContent("Primary key");
    expect(screen.getByText("Address line 2").parentElement).toHaveTextContent("—");
    expect(screen.getByText("2026-10-18T12:00:00Z").parentElement).toHaveTextContent("Server managed");
    expect(screen.queryByRole("button", { name: "Address ID" })).not.toBeInTheDocument();
  });

  it("honors an explicit read-only editability decision even when a save handler exists", () => {
    renderFields([{ label: "Generated slug", value: "life-dashboard", editable: false, onSave: vi.fn() }]);

    expect(screen.getByText("life-dashboard")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generated slug" })).not.toBeInTheDocument();
  });

  it("saves typed values, sends null for clearing nullable values, and retains errors for correction", async () => {
    const saveNumber = vi.fn().mockResolvedValue(undefined);
    const saveNullable = vi.fn().mockRejectedValueOnce(new APIError("Invalid value", 422)).mockResolvedValue(undefined);
    renderFields([
      { label: "Monthly amount", value: 80, inputType: "number", onSave: saveNumber },
      { label: "Notes", value: "Old note", nullable: true, onSave: saveNullable },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Monthly amount: 80" }));
    fireEvent.change(screen.getByLabelText("Monthly amount"), { target: { value: "95.5" } });
    fireEvent.blur(screen.getByLabelText("Monthly amount"));
    await waitFor(() => expect(saveNumber).toHaveBeenCalledWith(95.5));

    fireEvent.click(screen.getByRole("button", { name: "Notes: Old note" }));
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Corrected note" } });
    fireEvent.blur(screen.getByLabelText("Notes"));
    expect(await screen.findByRole("alert", { hidden: true })).toHaveTextContent("Some information is invalid");
    expect(screen.getByLabelText("Notes")).toHaveValue("Corrected note");
    fireEvent.click(screen.getByRole("button", { name: "Clear value", hidden: true }));
    fireEvent.blur(screen.getByLabelText("Notes"));
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

    fireEvent.click(screen.getByRole("button", { name: "First receipt item: false" }));
    fireEvent.click(screen.getByLabelText("First receipt item"));
    await waitFor(() => expect(saveBoolean).toHaveBeenCalledWith(true));

    fireEvent.click(screen.getByRole("button", { name: "Current" }));
    // Tamagui's select is a combobox; changing its button value does not select an item.
    fireEvent.click(screen.getByRole("combobox", { name: "Status", hidden: true }));
    fireEvent.keyDown(screen.getByRole("option", { name: "Former", hidden: true }), { key: "Enter" });
    await waitFor(() => expect(saveStatus).toHaveBeenCalledWith("Former"));
  });

  it("keeps a primitive URL input controlled and saves its edited value on blur", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderFields([{ label: "Website", value: "https://example.com", primitive: "url", inputType: "url", onSave: save }]);

    fireEvent.click(screen.getByRole("button", { name: "https://example.com" }));
    const input = screen.getByLabelText("Website");
    fireEvent.change(input, { target: { value: "https://updated.example.com" } });
    expect(input).toHaveValue("https://updated.example.com");
    fireEvent.blur(input);

    await waitFor(() => expect(save).toHaveBeenCalledWith("https://updated.example.com"));
  });
});
