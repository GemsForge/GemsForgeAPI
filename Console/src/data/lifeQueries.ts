import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export const lifeQueryKeys = {
  gemHues: ["gem-hues"] as const,
  education: ["education"] as const,
  employment: ["employment"] as const,
  addresses: ["addresses"] as const,
  transactions: ["transactions"] as const,
  serviceAccounts: ["service-accounts"] as const,
  serviceLogos: ["service-logos"] as const,
  expenseCategories: ["expense-categories"] as const,
  merchants: ["merchants"] as const,
  expenseSubcategories: (categoryID: number | null) => ["expense-subcategories", categoryID] as const,
};

/** Reads the Foundation Gem Hues catalog for the active screen. */
export function useGemHuesQuery(enabled: boolean) {
  return useQuery({ queryKey: lifeQueryKeys.gemHues, queryFn: ({ signal }) => api.listGemHues(signal), enabled });
}

export function useExpenseCategoriesQuery(enabled: boolean) {
  return useQuery({
    queryKey: lifeQueryKeys.expenseCategories,
    queryFn: ({ signal }) => api.listExpenseCategories(signal),
    enabled,
  });
}

export function useMerchantsQuery(enabled: boolean) {
  return useQuery({ queryKey: lifeQueryKeys.merchants, queryFn: ({ signal }) => api.listMerchants(signal), enabled });
}

export function useExpenseSubcategoriesQuery(categoryID: number | null, enabled: boolean) {
  return useQuery({
    queryKey: lifeQueryKeys.expenseSubcategories(categoryID),
    queryFn: ({ signal }) => api.listExpenseSubcategories(categoryID, signal),
    enabled: enabled && categoryID !== null,
  });
}

/** Reads Life education records for the active screen. */
export function useEducationQuery(enabled: boolean) {
  return useQuery({ queryKey: lifeQueryKeys.education, queryFn: ({ signal }) => api.listEducation(signal), enabled });
}

/** Reads Life employment records for the active screen. */
export function useEmploymentQuery(enabled: boolean) {
  return useQuery({ queryKey: lifeQueryKeys.employment, queryFn: ({ signal }) => api.listEmployment(signal), enabled });
}

/** Reads Life address records for the active screen. */
export function useAddressesQuery(enabled: boolean) {
  return useQuery({ queryKey: lifeQueryKeys.addresses, queryFn: ({ signal }) => api.listAddresses(signal), enabled });
}

/** Reads documented expense transactions for the active screen. */
export function useTransactionsQuery(enabled: boolean) {
  return useQuery({
    queryKey: lifeQueryKeys.transactions,
    queryFn: ({ signal }) => api.listTransactions(signal),
    enabled,
  });
}

/** Reads recurring service accounts backed by the Services table. */
export function useServiceAccountsQuery(enabled: boolean) {
  return useQuery({
    queryKey: lifeQueryKeys.serviceAccounts,
    queryFn: ({ signal }) => api.listServiceAccounts(signal),
    enabled,
  });
}

export function useServiceLogosQuery(enabled: boolean) {
  return useQuery({ queryKey: lifeQueryKeys.serviceLogos, queryFn: ({ signal }) => api.listServiceLogos(signal), enabled });
}
