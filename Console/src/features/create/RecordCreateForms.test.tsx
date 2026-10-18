import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppleMapsSearchClient } from "../addresses/AppleMapsAddressSearch";
import { AddressCreateForm } from "./RecordCreateForms";

afterEach(() => {
  vi.useRealTimers();
});

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

  it("fills editable address fields from the selected Apple Maps result", async () => {
    vi.useFakeTimers();
    const suggestion = {
      displayLines: ["1 Apple Park Way", "Cupertino, CA 95014"],
    };
    const addressSearchClient: AppleMapsSearchClient = {
      autocomplete: vi.fn().mockResolvedValue({ results: [suggestion] }),
      search: vi.fn().mockResolvedValue({
        places: [
          {
            fullThoroughfare: "1 Apple Park Way",
            locality: "Cupertino",
            administrativeArea: "California",
            administrativeAreaCode: "CA",
            postCode: "95014",
            country: "United States",
            countryCode: "US",
          },
        ],
      }),
    };
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<AddressCreateForm onCreate={onCreate} onCancel={vi.fn()} addressSearchClient={addressSearchClient} />);

    const addressType = screen.getByRole("combobox", { name: "Address type *" });
    expect(
      within(addressType)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Select…", "Residence", "Storage", "Work", "Other"]);

    fireEvent.change(screen.getByLabelText("Search places or addresses"), {
      target: { value: "Apple Park" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    fireEvent.click(screen.getByRole("button", { name: "1 Apple Park Way, Cupertino, CA 95014" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByLabelText("Address line 1")).toHaveValue("1 Apple Park Way");
    expect(screen.getByLabelText("City")).toHaveValue("Cupertino");
    expect(screen.getByLabelText("State / region")).toHaveValue("CA");
    expect(screen.getByLabelText("Postal code")).toHaveValue("95014");
    expect(screen.getByLabelText("Country *")).toHaveValue("US");
    expect(screen.getByLabelText("Stable address ID *")).toHaveValue("");
    expect(addressType).toHaveValue("Residence");

    vi.useRealTimers();
    fireEvent.change(screen.getByLabelText("Stable address ID *"), { target: { value: "ADDR-APPLE" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "ADDR-APPLE",
          addressLine1: "1 Apple Park Way",
          city: "Cupertino",
          state: "CA",
          postalCode: "95014",
          country: "US",
        }),
      ),
    );
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
