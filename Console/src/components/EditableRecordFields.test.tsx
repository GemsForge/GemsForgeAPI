import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { APIError } from "../api";
import { EditableRecordFields } from "./EditableRecordFields";

describe("EditableRecordFields", () => {
  it("renders server-owned values read-only and editable values using their declared input type", () => {
    render(
      <EditableRecordFields
        fields={[
          { label: "Address line 1", value: "3283 Boring Rd", onSave: vi.fn() },
          { label: "Address ID", value: "ADDR-1", readOnlyReason: "Primary key" },
          { label: "Address line 2", value: undefined },
          { label: "Last updated", value: "2026-10-18T12:00:00Z", readOnlyReason: "Server managed" },
        ]}
      />,
    );

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
    render(
      <EditableRecordFields
        fields={[
          { label: "Monthly amount", value: 80, inputType: "number", onSave: saveNumber },
          { label: "Notes", value: "Old note", nullable: true, onSave: saveNullable },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit monthly amount" }));
    fireEvent.change(screen.getByLabelText("Monthly amount"), { target: { value: "95.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save monthly amount" }));
    await waitFor(() => expect(saveNumber).toHaveBeenCalledWith(95.5));

    fireEvent.click(screen.getByRole("button", { name: "Edit notes" }));
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Corrected note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save notes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Some information is invalid");
    expect(screen.getByLabelText("Notes")).toHaveValue("Corrected note");
    fireEvent.click(screen.getByRole("button", { name: "Clear value" }));
    fireEvent.click(screen.getByRole("button", { name: "Save notes" }));
    await waitFor(() => expect(saveNullable).toHaveBeenLastCalledWith(null));
  });

  it("handles booleans and controlled select values", async () => {
    const saveBoolean = vi.fn().mockResolvedValue(undefined);
    const saveStatus = vi.fn().mockResolvedValue(undefined);
    render(
      <EditableRecordFields
        fields={[
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
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit first receipt item" }));
    fireEvent.click(screen.getByLabelText("First receipt item"));
    fireEvent.click(screen.getByRole("button", { name: "Save first receipt item" }));
    await waitFor(() => expect(saveBoolean).toHaveBeenCalledWith(true));

    fireEvent.click(screen.getByRole("button", { name: "Edit status" }));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Former" } });
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));
    await waitFor(() => expect(saveStatus).toHaveBeenCalledWith("Former"));
  });
});
