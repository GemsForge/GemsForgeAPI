import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { TrashEntryInput } from "../types";
import { lifeQueryKeys } from "./lifeQueries";
import { presentationQueryKeys } from "./presentationQueries";

export const trashQueryKeys = {
  entries: ["trash"] as const,
};

export function useTrashEntriesQuery() {
  return useQuery({
    queryKey: trashQueryKeys.entries,
    queryFn: ({ signal }) => api.listTrash(signal),
  });
}

export function useArchiveRecordMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TrashEntryInput) => api.archiveRecord(input),
    onSuccess: () => client.invalidateQueries({ queryKey: trashQueryKeys.entries }),
  });
}

export function useRestoreTrashEntryMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (entryID: string) => api.restoreTrashEntry(entryID),
    onSuccess: () => client.invalidateQueries({ queryKey: trashQueryKeys.entries }),
  });
}

const recordListQueryByTable: Record<string, readonly unknown[]> = {
  Addresses: lifeQueryKeys.addresses,
  Education: lifeQueryKeys.education,
  Employment: lifeQueryKeys.employment,
  ExpenseTransaction: lifeQueryKeys.transactions,
  Transactions: lifeQueryKeys.transactions,
  GemHues: lifeQueryKeys.gemHues,
  Services: lifeQueryKeys.serviceAccounts,
};

export function usePermanentlyDeleteTrashEntryMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (entryID: string) => api.permanentlyDeleteTrashEntry(entryID),
    onSuccess: async (_result, entryID) => {
      const entries = client.getQueryData<Awaited<ReturnType<typeof api.listTrash>>>(trashQueryKeys.entries) ?? [];
      const removed = entries.find((entry) => entry.entryID === entryID);
      await client.invalidateQueries({ queryKey: trashQueryKeys.entries });
      if (removed) {
        const listQueryKey = recordListQueryByTable[removed.tableName];
        if (listQueryKey) await client.invalidateQueries({ queryKey: listQueryKey });
        await client.invalidateQueries({
          queryKey: presentationQueryKeys.recordPresentations(removed.tableName),
        });
      }
    },
  });
}
