import { QueryClient } from "@tanstack/react-query";
import { APIError } from "../api";

/** Shared server-state policy for the Gem Life React client. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => failureCount < 1 && !(error instanceof APIError && error.status >= 400 && error.status < 500),
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
