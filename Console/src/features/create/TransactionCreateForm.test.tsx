import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "../../design-system";
import { TransactionCreateForm } from "./RecordCreateForms";

vi.mock("../../data/lifeQueries", () => ({
  useExpenseCategoriesQuery: () => ({ data: [{ id: 3, name: "Food" }] }),
  useExpenseSubcategoriesQuery: () => ({ data: [] }),
  useMerchantsQuery: () => ({ data: [{ id: "SHOP", name: "Shop" }] }),
}));

describe("TransactionCreateForm", () => {
  it("submits the shared checkbox and merchant properties in the create payload", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
          <TransactionCreateForm onCreate={onCreate} onCancel={vi.fn()} />
        </TamaguiProvider>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Stable transaction ID *"), { target: { value: "TX-1" } });
    fireEvent.change(screen.getByLabelText("Item *"), { target: { value: "Coffee" } });
    const paidPrice = screen.getByLabelText("Paid price");
    expect(paidPrice).toHaveAttribute("step", "any");
    fireEvent.change(paidPrice, { target: { value: "1.25" } });
    fireEvent.click(screen.getByLabelText("First receipt item"));
    fireEvent.click(screen.getByRole("combobox", { name: /^Category/, hidden: true }));
    fireEvent.keyDown(screen.getByRole("option", { name: "Food", hidden: true }), { key: "Enter" });
    fireEvent.click(screen.getByRole("combobox", { name: /^Merchant/, hidden: true }));
    fireEvent.keyDown(screen.getByRole("option", { name: "Shop", hidden: true }), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      id: "TX-1", item: "Coffee", categoryID: 3, merchantCode: "SHOP", firstReceiptItem: true, paidPrice: 1.25,
    })));
  });
});
