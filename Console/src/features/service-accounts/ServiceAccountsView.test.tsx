import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
}));

describe("ServiceAccountsView", () => {
  beforeEach(() => mocks.patch.mockReset().mockResolvedValue(mocks.account));

  it("sends only the edited service property", async () => {
    render(<ServiceAccountsView records={[mocks.account]} />);
    fireEvent.click(screen.getByRole("button", { name: /Internet/ }));
    fireEvent.click(screen.getByRole("button", { name: "Edit service" }));
    fireEvent.change(screen.getByLabelText("Service"), { target: { value: "Fiber Internet" } });
    fireEvent.click(screen.getByRole("button", { name: "Save service" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith({ id: 7, patch: { service: "Fiber Internet" } }));
  });

  it("cancels a status edit without sending a PATCH", () => {
    render(<ServiceAccountsView records={[mocks.account]} />);
    fireEvent.click(screen.getByRole("button", { name: /Internet/ }));
    fireEvent.click(screen.getByRole("button", { name: "Edit status" }));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Paused" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});
