import { describe, expect, it, vi } from "vitest";
import type { Address, Employment, ExpenseTransaction, ServiceAccount } from "../../types";
import { addressFieldDefinitions } from "../addresses/addressCreateFields";
import { addressEditableFields } from "../addresses/addressRecordFields";
import { createEmploymentFieldDefinitions } from "../employment/employmentCreateFields";
import { employmentEditableFields } from "../employment/employmentRecordFields";
import { serviceAccountFieldDefinitions } from "../service-accounts/serviceAccountCreateFields";
import { serviceAccountEditableFields } from "../service-accounts/serviceAccountRecordFields";
import { createTransactionFieldDefinitions } from "../transactions/transactionCreateFields";
import { transactionEditableFields } from "../transactions/transactionRecordFields";

describe("record create and edit property parity", () => {
  it("uses Address definitions for all editable values", () => {
    const record = { addressType: "Residence", addressStatus: "Current" } as Address;
    const fields = addressEditableFields(record, vi.fn());
    expect(fields.slice(0, -1).map((field) => field.label)).toEqual(addressFieldDefinitions.map((field) => field.label));
    expect(fields.find((field) => field.label === "Status")).toMatchObject({ primitive: "status", required: true });
  });

  it("keeps Employment definitions and legacy option values available in edit", async () => {
    const definitions = createEmploymentFieldDefinitions({
      employerType: [{ value: "Organization", label: "Organization" }],
      industry: [], employmentType: [], status: [{ value: "Current", label: "Current" }], workAddress: [],
    });
    const patch = vi.fn().mockResolvedValue(undefined);
    const record = { employerType: "Private", employmentStatus: "Current" } as Employment;
    const fields = employmentEditableFields(record, definitions, patch);
    expect(fields.slice(0, -1).map((field) => field.label)).toEqual(definitions.filter((field) => field.name !== "id").map((field) => field.label));
    expect(fields.find((field) => field.label === "Employer type")?.options).toContainEqual({ value: "Private", label: "Private" });
    await fields.find((field) => field.label === "Employer type")?.onSave?.("Organization");
    expect(patch).toHaveBeenCalledWith({ employerType: "Organization" });
  });

  it("uses Service definitions while retaining a legacy payment method", () => {
    const record = { service: "Internet", paymentMethod: "Card", due: "July 10th" } as ServiceAccount;
    const fields = serviceAccountEditableFields(record, vi.fn());
    expect(fields.slice(0, serviceAccountFieldDefinitions.length).map((field) => field.label)).toEqual(serviceAccountFieldDefinitions.map((field) => field.label));
    expect(fields.find((field) => field.label === "Payment method")?.options).toContainEqual({ value: "Card", label: "Card" });
    expect(fields.find((field) => field.label === "Due")?.options).toContainEqual({ value: "July 10th", label: "July 10th" });
  });

  it("uses Transaction definitions and maps selected category IDs back to numbers", async () => {
    const category = { id: 3, name: "Food" };
    const definitions = createTransactionFieldDefinitions({ categories: [{ value: "3", label: "Food" }], subcategories: [] });
    const patch = vi.fn().mockResolvedValue(undefined);
    const record = { categoryID: 3, firstReceiptItem: true, merchantCode: "OLD" } as ExpenseTransaction;
    const fields = transactionEditableFields(record, [category] as Parameters<typeof transactionEditableFields>[1], [], [], patch);
    expect(fields.slice(0, -1).map((field) => field.label)).toEqual(definitions.filter((field) => field.name !== "id").map((field) => field.label));
    expect(fields.find((field) => field.label === "Merchant")?.options).toContainEqual({ value: "OLD", label: "OLD" });
    expect(fields.find((field) => field.label === "First receipt item")?.inputType).toBe("boolean");
    await fields.find((field) => field.label === "Category")?.onSave?.("3");
    expect(patch).toHaveBeenCalledWith({ categoryID: 3 });
  });
});
