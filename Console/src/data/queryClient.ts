import { QueryClient } from "@tanstack/react-query";

/** Shared server-state policy for the Gem Life React client. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
