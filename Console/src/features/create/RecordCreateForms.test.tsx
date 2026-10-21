import { act, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GeoapifySearchClient } from "../addresses/GeoapifyAddressSearch";
import { AddressCreateForm, EmploymentCreateForm } from "./RecordCreateForms";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../../design-system";
import type { Address } from "../../types";

function render(ui: React.ReactElement) {
  return rtlRender(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      {ui}
    </TamaguiProvider>,
  );
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

  it("renders employment classifications as shared Tamagui selects", () => {
    const workAddress: Address = {
      id: "ADDR-1",
      addressType: "Work",
      addressLine1: null,
      addressLine2: null,
      city: "Boston",
      state: "MA",
      postalCode: null,
      country: "US",
      startDate: null,
      endDate: null,
      addressStatus: "Current",
      notes: null,
      imageFileMetadataID: null,
    };

    render(
      <EmploymentCreateForm
        addresses={[workAddress]}
        employerTypeOptions={[{ value: "Company", label: "Company" }]}
        industryOptions={[{ value: "Technology", label: "Technology" }]}
        employmentTypeOptions={[{ value: "Full-time", label: "Full-time" }]}
        statusOptions={[{ value: "Current", label: "Current" }]}
        onCreate={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Employer type *")).toHaveAttribute("aria-haspopup", "listbox");
    expect(screen.getByLabelText("Industry")).toHaveAttribute("aria-haspopup", "listbox");
    expect(screen.getByLabelText("Employment type *")).toHaveAttribute("aria-haspopup", "listbox");
    expect(screen.getByLabelText("Status *")).toHaveAttribute("aria-haspopup", "listbox");
    expect(screen.getByLabelText("Website")).toHaveAttribute("type", "url");
    expect(screen.getByLabelText("Start date")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("End date")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Contact")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Contact number")).toHaveAttribute("type", "tel");
    expect(screen.getByLabelText("Contact email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Search Work address")).toHaveAttribute("placeholder", "Search existing addresses");
    expect(screen.queryByLabelText("Stable employment ID *")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Start date").closest(".create-form-grid--compact")).toBeInTheDocument();
    expect(screen.getByLabelText("End date").closest(".create-form-grid--compact")).toBeInTheDocument();
    expect(screen.getByLabelText("Status *").closest(".create-form-grid--compact")).toBeInTheDocument();
  });

  it("rejects invalid employment contact and date values before submitting", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <EmploymentCreateForm
        addresses={[]}
        employerTypeOptions={[{ value: "Company", label: "Company" }]}
        industryOptions={[]}
        employmentTypeOptions={[{ value: "Full-time", label: "Full-time" }]}
        statusOptions={[{ value: "Current", label: "Current" }]}
        onCreate={onCreate}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Employer name *"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Position title *"), { target: { value: "Engineer" } });
    fireEvent.change(screen.getByLabelText("Website"), { target: { value: "acme.example" } });
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2025-02-01" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2025-01-01" } });
    fireEvent.change(screen.getByLabelText("Contact number"), { target: { value: "fdfafr" } });
    fireEvent.change(screen.getByLabelText("Contact email"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByText("Enter a valid URL starting with http:// or https://.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid phone number.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("End date must be on or after start date.")).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
