import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import { useAddressesQuery } from "../../data/lifeQueries";
import { tamaguiConfig } from "../../design-system";
import { AddressesView } from "./AddressesView";
import type { Address } from "../../types";

const createdAddress: Address = {
  id: "ADDR-273",
  addressType: "Residence",
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

afterEach(() => {
  vi.restoreAllMocks();
});

function AddressScreen() {
  const query = useAddressesQuery(true);
  return query.data ? <AddressesView records={query.data} /> : <p role="status">Loading addresses</p>;
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <AddressScreen />
      </TamaguiProvider>
    </QueryClientProvider>,
  );
  return client;
}

describe("Addresses create/edit integration", () => {
  it("creates, refreshes, inspects, then PATCHes only the changed field", async () => {
    const list = vi.spyOn(api, "listAddresses").mockResolvedValueOnce([]).mockResolvedValue([createdAddress]);
    const create = vi.spyOn(api, "createAddress").mockResolvedValue(createdAddress);
    const patch = vi.spyOn(api, "patchAddress").mockResolvedValue({ ...createdAddress, city: "Cambridge" });
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Add address" }));
    fireEvent.change(screen.getByLabelText("Stable address ID *"), { target: { value: " ADDR-273 " } });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Boston" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("heading", { name: "Residence" })).toBeInTheDocument();
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0]).toEqual({
      id: "ADDR-273",
      addressType: "Residence",
      addressLine1: null,
      addressLine2: null,
      city: "Boston",
      state: null,
      postalCode: null,
      country: "US",
      startDate: null,
      endDate: null,
      addressStatus: "Current",
      notes: null,
    });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(screen.getByText("1 records")).toBeInTheDocument();
    expect(screen.queryByLabelText("Stable address ID *")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit city" }));
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Cambridge" } });
    fireEvent.click(screen.getByRole("button", { name: "Save city" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("ADDR-273", { city: "Cambridge" }));
    expect(patch.mock.calls[0][1]).toEqual({ city: "Cambridge" });
    expect(patch.mock.calls[0][1]).not.toHaveProperty("id");
    expect(patch.mock.calls[0][1]).not.toHaveProperty("createdAt");
  });

  it("retains values after API failure and allows cancellation without retrying", async () => {
    vi.spyOn(api, "listAddresses").mockResolvedValue([]);
    const create = vi.spyOn(api, "createAddress").mockRejectedValue(new Error("Duplicate address ID."));
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "Add address" }));
    fireEvent.change(screen.getByLabelText("Stable address ID *"), { target: { value: "ADDR-273" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Duplicate address ID.");
    expect(screen.getByLabelText("Stable address ID *")).toHaveValue("ADDR-273");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form", { name: "Create address" })).not.toBeInTheDocument();
    expect(create).toHaveBeenCalledOnce();
  });
});
