import { act, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GeoapifySearchClient } from "../addresses/GeoapifyAddressSearch";
import { AddressCreateForm } from "./RecordCreateForms";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../../design-system";

function render(ui: React.ReactElement) {
  return rtlRender(<TamaguiProvider config={tamaguiConfig}>{ui}</TamaguiProvider>);
}

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

  it("prefills an address from a selected Geoapify result and preserves form-owned values", async () => {
    vi.useFakeTimers();
    const suggestion = {
      properties: {
        formatted: "1600 Pennsylvania Avenue NW, Washington, DC 20500, United States",
        address_line1: "1600 Pennsylvania Avenue NW",
        city: "Washington",
        state_code: "DC",
        postcode: "20500",
        country_code: "us",
      },
    };
    const addressSearchClient: GeoapifySearchClient = {
      autocomplete: vi.fn().mockResolvedValue([suggestion]),
    };
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<AddressCreateForm onCreate={onCreate} onCancel={vi.fn()} addressSearchClient={addressSearchClient} />);

    fireEvent.change(screen.getByLabelText("Stable address ID *"), { target: { value: "ADDR-USER" } });
    fireEvent.change(screen.getByLabelText("Search places or addresses"), { target: { value: "1600 Pennsylvania" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    fireEvent.click(screen.getByRole("button", { name: suggestion.properties.formatted }));

    expect(screen.getByLabelText("Stable address ID *")).toHaveValue("ADDR-USER");
    expect(screen.getByLabelText("Address line 1")).toHaveValue("1600 Pennsylvania Avenue NW");
    expect(screen.getByLabelText("City")).toHaveValue("Washington");
    expect(screen.getByLabelText("State / region")).toHaveValue("DC");
    expect(screen.getByLabelText("Postal code")).toHaveValue("20500");
    expect(screen.getByLabelText("Country *")).toHaveValue("US");
    expect(screen.getByLabelText("Address type *")).toHaveValue("Residence");

    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "ADDR-USER",
          addressLine1: "1600 Pennsylvania Avenue NW",
          city: "Washington",
          state: "DC",
          postalCode: "20500",
          country: "US",
          addressType: "Residence",
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
