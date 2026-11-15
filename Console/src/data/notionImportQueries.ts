import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export function useNotionImportPreviewQuery() {
  return useQuery({
    queryKey: ["notion-import", "preview"],
    queryFn: ({ signal }) => api.previewNotionImport(signal),
    enabled: false,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
}
