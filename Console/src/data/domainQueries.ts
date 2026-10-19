import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export const domainQueryKeys = {
  all: ["domains"] as const,
};

/** Reads and caches the stable Gem Life domain catalog. */
export function useDomainsQuery() {
  return useQuery({
    queryKey: domainQueryKeys.all,
    queryFn: ({ signal }) => api.listDomains(signal),
  });
}

export function useCreateDomainMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.createDomain,
    onSuccess: async (domain) => {
      client.setQueryData(domainQueryKeys.all, (current: import("../types").Domain[] | undefined) =>
        current ? [...current.filter((item) => item.id !== domain.id), domain] : [domain],
      );
      await client.invalidateQueries({ queryKey: domainQueryKeys.all, exact: true });
    },
  });
}

export function useDomainPatchMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<import("../types").Domain, "title" | "description">>;
    }) => api.patchDomain(id, patch),
    onSuccess: async (domain) => {
      client.setQueryData(domainQueryKeys.all, (current: import("../types").Domain[] | undefined) =>
        current?.map((item) => (item.id === domain.id ? domain : item)),
      );
      await client.invalidateQueries({ queryKey: domainQueryKeys.all, exact: true });
    },
  });
}
