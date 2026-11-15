import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export const recordBodyQueryKeys = {
  body: (tableName: string, recordID: string) => ["record-body", tableName, recordID] as const,
  excerpts: (tableName: string) => ["record-body-excerpts", tableName] as const,
};

export function useRecordBodyQuery(tableName: string, recordID: string) {
  return useQuery({
    queryKey: recordBodyQueryKeys.body(tableName, recordID),
    queryFn: ({ signal }) => api.getRecordBody(tableName, recordID, signal),
  });
}

export function useRecordBodyExcerptsQuery(tableName: string) {
  return useQuery({
    queryKey: recordBodyQueryKeys.excerpts(tableName),
    queryFn: ({ signal }) => api.listRecordBodyExcerpts(tableName, signal),
  });
}

export function useSaveRecordBodyMutation(tableName: string, recordID: string) {
  const client = useQueryClient();
  const queryKey = recordBodyQueryKeys.body(tableName, recordID);
  return useMutation({
    mutationFn: ({ markdown, baseRevision }: { markdown: string; baseRevision: number }) =>
      api.saveRecordBody(tableName, recordID, markdown, baseRevision),
    onSuccess: (body) => {
      client.setQueryData(queryKey, body);
      void client.invalidateQueries({ queryKey: recordBodyQueryKeys.excerpts(tableName) });
    },
  });
}
