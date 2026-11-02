import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { APIError, api } from "../api";

export const presentationQueryKeys = {
  recordPresentations: (tableName: string) => ["record-presentations", tableName] as const,
  tableViews: (tableName: string) => ["table-views", tableName] as const,
};

export function useRecordPresentationsQuery(tableName: string) {
  return useQuery({
    queryKey: presentationQueryKeys.recordPresentations(tableName),
    queryFn: ({ signal }) => api.listRecordPresentations(tableName, signal),
  });
}

export function useSaveRecordPresentationMutation(tableName: string) {
  const client = useQueryClient();
  const queryKey = presentationQueryKeys.recordPresentations(tableName);
  return useMutation({
    mutationFn: ({ recordID, presentation }: { recordID: string; presentation: string }) =>
      api.saveRecordPresentation(tableName, recordID, presentation),
    onMutate: async ({ recordID, presentation }) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<Awaited<ReturnType<typeof api.listRecordPresentations>>>(queryKey);
      client.setQueryData(queryKey, (current: { recordID: string; presentation: string }[] = []) => [
        ...current.filter((item) => item.recordID !== recordID),
        { recordID, presentation },
      ]);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(queryKey, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
}

export function useDeleteRecordPresentationMutation(tableName: string) {
  const client = useQueryClient();
  const queryKey = presentationQueryKeys.recordPresentations(tableName);
  return useMutation({
    mutationFn: (recordID: string) => api.deleteRecordPresentation(tableName, recordID),
    onMutate: async (recordID) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<Awaited<ReturnType<typeof api.listRecordPresentations>>>(queryKey);
      client.setQueryData(queryKey, (current: { recordID: string; presentation: string }[] = []) =>
        current.filter((item) => item.recordID !== recordID),
      );
      return { previous };
    },
    onError: (_error, _recordID, context) => {
      if (context?.previous) client.setQueryData(queryKey, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
}

export function useTableViewsQuery(tableName: string) {
  return useQuery({
    queryKey: presentationQueryKeys.tableViews(tableName),
    queryFn: async ({ signal }) => {
      const results = await Promise.all(
        (["List", "Gallery", "Table"] as const).map(async (viewType) => {
          try {
            return [viewType, await api.getTableView(tableName, viewType, signal)] as const;
          } catch (error) {
            if (error instanceof APIError && error.status === 404) return [viewType, null] as const;
            throw error;
          }
        }),
      );
      return Object.fromEntries(results) as Record<
        "List" | "Gallery" | "Table",
        Awaited<ReturnType<typeof api.getTableView>> | null
      >;
    },
  });
}

export function useSaveTableViewWorkspaceStateMutation(tableName: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ viewType, workspaceState }: { viewType: "List" | "Gallery" | "Table"; workspaceState: string }) =>
      api.saveTableViewWorkspaceState(tableName, viewType, workspaceState),
    onSettled: () => client.invalidateQueries({ queryKey: presentationQueryKeys.tableViews(tableName) }),
  });
}

export function useSaveTableViewColumnsMutation(tableName: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      viewType,
      columns,
    }: {
      viewType: "List" | "Gallery" | "Table";
      columns: Parameters<typeof api.saveTableViewColumns>[2];
    }) => api.saveTableViewColumns(tableName, viewType, columns),
    onSettled: () => client.invalidateQueries({ queryKey: presentationQueryKeys.tableViews(tableName) }),
  });
}
