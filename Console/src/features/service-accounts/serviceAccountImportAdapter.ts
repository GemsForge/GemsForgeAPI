export const serviceAccountImportColumns = [
  "Service", "Type", "ExpenseGroup", "MonthlyAmount", "InterestRate", "APR", "Due", "Occurrence", "Status",
  "Since", "Website", "Notes", "PaymentMethod", "AccountNumber", "AssociatedAddress", "ServiceKey",
];

/** Map external import columns into the Service Account create contract. */
export function toServiceAccountCreatePayload(row: Record<string, unknown>) {
  return {
    service: String(row.Service ?? row.service ?? ""),
    type: String(row.Type ?? row.type ?? "") || null,
    expenseGroup: String(row.ExpenseGroup ?? "") || null,
    monthlyAmount: row.MonthlyAmount ? Number(row.MonthlyAmount) : null,
    interestRate: row.InterestRate ? Number(row.InterestRate) : null,
    apr: row.APR ? Number(row.APR) : null,
    due: String(row.Due ?? "") || null,
    occurrence: String(row.Occurrence ?? "") || null,
    status: String(row.Status ?? "") || null,
    since: String(row.Since ?? "") || null,
    website: String(row.Website ?? "") || null,
    notes: String(row.Notes ?? "") || null,
    paymentMethod: String(row.PaymentMethod ?? "") || null,
    accountNumber: String(row.AccountNumber ?? "") || null,
    associatedAddress: String(row.AssociatedAddress ?? "") || null,
    serviceKey: String(row.ServiceKey ?? "") || null,
  };
}
