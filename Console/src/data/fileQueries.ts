import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export const fileQueryKeys = {
  metadata: (id: string) => ["file-metadata", id] as const,
};

/** Metadata is cacheable server state; preview bytes stay scoped to the viewer. */
export function useFileMetadataQuery(id: string) {
  return useQuery({
    queryKey: fileQueryKeys.metadata(id),
    queryFn: ({ signal }) => api.getFileMetadata(id, signal),
    retry: false,
  });
}
