import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export const lifeQueryKeys = {
  gemHues: ["gem-hues"] as const,
  education: ["education"] as const,
  employment: ["employment"] as const,
  addresses: ["addresses"] as const,
  transactions: ["transactions"] as const,
  serviceAccounts: ["service-accounts"] as const,
};

/** Reads the Foundation Gem Hues catalog for the active screen. */
export function useGemHuesQuery(enabled: boolean) {
  return useQuery({ queryKey: lifeQueryKeys.gemHues, queryFn: ({ signal }) => api.listGemHues(signal), enabled });
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
