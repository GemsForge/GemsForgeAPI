import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export const domainQueryKeys = {
  all: ["domains"] as const,
};

/** Reads and caches the stable Gem Life domain catalog. */
export function useDomainsQuery() {
  return useQuery({
    queryKey: domainQueryKeys.all,
    queryFn: api.listDomains,
  });
}
