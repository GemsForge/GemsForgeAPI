import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServiceAccountsView } from "./ServiceAccountsView";
import type { ServiceAccount } from "../../types";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../../design-system";

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
  } as ServiceAccount,
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
        <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
          <ServiceAccountsView records={[mocks.account]} />
        </TamaguiProvider>
      </QueryClientProvider>,
    );
  }

  /** Wait for the renderer's single-click detail gesture to settle before editing a field. */
  async function openDetails() {
    fireEvent.keyDown(screen.getByRole("listitem", { name: "Open Internet" }), { key: "Enter" });
    await screen.findByRole("button", { name: "Service: Internet", hidden: true });
  }

  it("sends only the edited service property", async () => {
    renderView();
    // Keep a regression guard for the first consumer migrated to Table Kit.
    expect(screen.getByRole("region", { name: "Table content" })).toBeInTheDocument();
    // The list item itself now opens details; there is no nested View action.
    await openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Service: Internet", hidden: true }));
    // Required-field labels include a visible asterisk in the shared field component.
    fireEvent.change(screen.getByLabelText(/^Service \*/), { target: { value: "Fiber Internet" } });
    fireEvent.blur(screen.getByLabelText(/^Service \*/));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith({ id: 7, patch: { service: "Fiber Internet" } }));
  });

  it("saves a status change directly from the inline selector", async () => {
    renderView();
    await openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Active", hidden: true }));
    fireEvent.click(screen.getByRole("combobox", { name: /^Status/, hidden: true }));
    fireEvent.keyDown(screen.getByRole("option", { name: "Paused", hidden: true }), { key: "Enter" });
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith({ id: 7, patch: { status: "Paused" } }));
  });

  it("edits the service key through a changed-only PATCH", async () => {
    renderView();
    await openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Service key: —", hidden: true }));
    fireEvent.change(screen.getByLabelText("Service key"), { target: { value: "INTERNET_SERVICE" } });
    fireEvent.blur(screen.getByLabelText("Service key"));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith({ id: 7, patch: { serviceKey: "INTERNET_SERVICE" } }));
  });

  it("edits Email Updated with a checkbox", async () => {
    mocks.account.emailUpdated = false;
    renderView();
    await openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Email updated: false", hidden: true }));
    fireEvent.click(screen.getByLabelText("Email updated"));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith({ id: 7, patch: { emailUpdated: true } }));
    mocks.account.emailUpdated = null;
  });

  it("explains why legacy logo and address relationship values stay read-only", async () => {
    renderView();
    await openDetails();
    expect(
      await screen.findByText("Legacy logo lookup relationship; no validated selector is available."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Legacy address value; no normalized, validated address selector is available."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit logo key" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit associated address" })).not.toBeInTheDocument();
  });
});
