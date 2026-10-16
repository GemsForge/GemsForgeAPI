import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddressCreateForm } from "./RecordCreateForms";

describe("shared create form workflow", () => {
  it("validates required fields before submitting", async () => {
    const onCreate = vi.fn();
    render(<AddressCreateForm onCreate={onCreate} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));
    expect(await screen.findByText("Address ID is required.")).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("submits the explicit payload and closes through the caller on success", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    render(<AddressCreateForm onCreate={onCreate} onCancel={onCancel} />);
    fireEvent.change(screen.getByLabelText("Stable address ID *"), { target: { value: " A-1 " } });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Boston" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "A-1", city: "Boston", country: "US", addressStatus: "Current" }),
      ),
    );
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("preserves entered values after an API failure and exposes the error", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("Address ID already exists."));
    render(<AddressCreateForm onCreate={onCreate} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Stable address ID *"), { target: { value: "A-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Address ID already exists.");
    expect(screen.getByLabelText("Stable address ID *")).toHaveValue("A-1");
  });

  it("cancels without submitting", () => {
    const onCreate = vi.fn();
    const onCancel = vi.fn();
    render(<AddressCreateForm onCreate={onCreate} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
