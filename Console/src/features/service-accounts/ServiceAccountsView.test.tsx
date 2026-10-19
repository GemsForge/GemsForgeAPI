import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServiceAccountsView } from "./ServiceAccountsView";
import type { ServiceAccount } from "../../types";

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  account: {
    id: 7,
    service: "Internet",
    logoKey: null,
    type: "Utility",
    expenseGroup: "Home",
    monthlyAmount: 80,
    interestRate: null,
    apr: null,
    due: "15",
    occurrence: "Monthly",
    status: "Active",
    since: null,
    website: null,
    notes: null,
    notionPage: null,
    paymentMethod: "Card",
    accountNumber: null,
    emailUpdated: null,
    associatedAddress: null,
    serviceKey: null,
    logoFileMetadataID: null,
  } satisfies ServiceAccount,
}));

vi.mock("../../data/recordQueries", () => ({
  useServiceAccountQuery: () => ({ data: mocks.account, isPending: false, isLoading: false, error: null }),
  useServiceAccountPatchMutation: () => ({ mutateAsync: mocks.patch, isPending: false, error: null }),
  useCreateServiceAccountMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../../components/AttachmentControl", () => ({
  AttachmentControl: () => <div>Service logo attachment</div>,
}));

describe("ServiceAccountsView", () => {
  beforeEach(() => mocks.patch.mockReset().mockResolvedValue(mocks.account));

  function renderView() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ServiceAccountsView records={[mocks.account]} />
      </QueryClientProvider>,
    );
  }

  it("sends only the edited service property", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /Internet/ }));
    fireEvent.click(screen.getByRole("button", { name: "Edit service" }));
    fireEvent.change(screen.getByLabelText("Service"), { target: { value: "Fiber Internet" } });
    fireEvent.click(screen.getByRole("button", { name: "Save service" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith({ id: 7, patch: { service: "Fiber Internet" } }));
  });

  it("cancels a status edit without sending a PATCH", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /Internet/ }));
    fireEvent.click(screen.getByRole("button", { name: "Edit status" }));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Paused" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("edits the service key through a changed-only PATCH", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /Internet/ }));
    fireEvent.click(screen.getByRole("button", { name: "Edit service key" }));
    fireEvent.change(screen.getByLabelText("Service key"), { target: { value: "INTERNET_SERVICE" } });
    fireEvent.click(screen.getByRole("button", { name: "Save service key" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith({ id: 7, patch: { serviceKey: "INTERNET_SERVICE" } }));
  });

  it("explains why legacy logo and address relationship values stay read-only", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /Internet/ }));
    expect(
      screen.getByText("Legacy logo lookup relationship; no validated selector is available."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Legacy address value; no normalized, validated address selector is available."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit logo key" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit associated address" })).not.toBeInTheDocument();
  });
});
