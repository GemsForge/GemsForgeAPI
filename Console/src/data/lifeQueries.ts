import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export const lifeQueryKeys = {
  gemHues: ["gem-hues"] as const,
  education: ["education"] as const,
  employment: ["employment"] as const,
  addresses: ["addresses"] as const,
  transactions: ["transactions"] as const,
};

/** Reads the Foundation Gem Hues catalog for the active screen. */
export function useGemHuesQuery(enabled: boolean) {
  return useQuery({ queryKey: lifeQueryKeys.gemHues, queryFn: api.listGemHues, enabled });
}

/** Reads Life education records for the active screen. */
export function useEducationQuery(enabled: boolean) {
  return useQuery({ queryKey: lifeQueryKeys.education, queryFn: api.listEducation, enabled });
}

/** Reads Life employment records for the active screen. */
export function useEmploymentQuery(enabled: boolean) {
  return useQuery({ queryKey: lifeQueryKeys.employment, queryFn: api.listEmployment, enabled });
}

/** Reads Life address records for the active screen. */
export function useAddressesQuery(enabled: boolean) {
  return useQuery({ queryKey: lifeQueryKeys.addresses, queryFn: api.listAddresses, enabled });
}

/** Reads documented expense transactions for the active screen. */
export function useTransactionsQuery(enabled: boolean) {
  return useQuery({ queryKey: lifeQueryKeys.transactions, queryFn: api.listTransactions, enabled });
}
