import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { lifeQueryKeys } from "./lifeQueries";

export const recordQueryKeys = {
  address: (id: string | null) => [...lifeQueryKeys.addresses, "detail", id] as const,
  transaction: (id: string | null) => [...lifeQueryKeys.transactions, "detail", id] as const,
  education: (id: string | null) => [...lifeQueryKeys.education, "detail", id] as const,
  employment: (id: string | null) => [...lifeQueryKeys.employment, "detail", id] as const,
  serviceAccount: (id: number | null) => [...lifeQueryKeys.serviceAccounts, "detail", id] as const,
  hue: (id: string | null) => [...lifeQueryKeys.gemHues, "detail", id] as const,
};

export function useAddressQuery(id: string | null) {
  return useQuery({
    queryKey: recordQueryKeys.address(id),
    queryFn: ({ signal }) => api.getAddress(id!, signal),
    enabled: id !== null,
  });
}
function useCreateMutation<TPayload, TResult>(
  mutationFn: (payload: TPayload) => Promise<TResult>,
  listKey: readonly unknown[],
  getID: (record: TResult) => string | number,
  detailKey: (id: string | number) => readonly unknown[],
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (record) => {
      client.setQueryData(detailKey(getID(record)), record);
      await client.invalidateQueries({ queryKey: listKey, exact: true });
    },
  });
}
export function useCreateAddressMutation() {
  return useCreateMutation(
    api.createAddress,
    lifeQueryKeys.addresses,
    (record) => record.id,
    (id) => recordQueryKeys.address(String(id)),
  );
}
export function useCreateEducationMutation() {
  return useCreateMutation(
    api.createEducation,
    lifeQueryKeys.education,
    (record) => record.id,
    (id) => recordQueryKeys.education(String(id)),
  );
}
export function useCreateEmploymentMutation() {
  return useCreateMutation(
    api.createEmployment,
    lifeQueryKeys.employment,
    (record) => record.id,
    (id) => recordQueryKeys.employment(String(id)),
  );
}
export function useCreateTransactionMutation() {
  return useCreateMutation(
    api.createTransaction,
    lifeQueryKeys.transactions,
    (record) => record.id,
    (id) => recordQueryKeys.transaction(String(id)),
  );
}
export function useCreateServiceAccountMutation() {
  return useCreateMutation(
    api.createServiceAccount,
    lifeQueryKeys.serviceAccounts,
    (record) => record.id,
    (id) => recordQueryKeys.serviceAccount(Number(id)),
  );
}
export function useTransactionQuery(id: string | null) {
  return useQuery({
    queryKey: recordQueryKeys.transaction(id),
    queryFn: ({ signal }) => api.getTransaction(id!, signal),
    enabled: id !== null,
  });
}
export function useEducationRecordQuery(id: string | null) {
  return useQuery({
    queryKey: recordQueryKeys.education(id),
    queryFn: ({ signal }) => api.getEducation(id!, signal),
    enabled: id !== null,
  });
}
export function useEmploymentRecordQuery(id: string | null) {
  return useQuery({
    queryKey: recordQueryKeys.employment(id),
    queryFn: ({ signal }) => api.getEmployment(id!, signal),
    enabled: id !== null,
  });
}
export function useServiceAccountQuery(id: number | null) {
  return useQuery({
    queryKey: recordQueryKeys.serviceAccount(id),
    queryFn: ({ signal }) => api.getServiceAccount(id!, signal),
    enabled: id !== null,
  });
}
export function useGemHueQuery(id: string | null) {
  return useQuery({
    queryKey: recordQueryKeys.hue(id),
    queryFn: ({ signal }) => api.getGemHue(id!, signal),
    enabled: id !== null,
  });
}
export function useCreateGemHueMutation() {
  return useCreateMutation(
    api.createGemHue,
    lifeQueryKeys.gemHues,
    (record) => record.id,
    (id) => recordQueryKeys.hue(String(id)),
  );
}
export function useGemHueImageQuery(id: string | null) {
  return useQuery({
    queryKey: [...lifeQueryKeys.gemHues, "image", id],
    enabled: id !== null,
    retry: false,
    gcTime: 60_000,
    queryFn: async ({ signal }) => {
      const response = await api.getGemHueImage(id!, signal);
      const blob = await response.blob();
      if (!blob.type.startsWith("image/") || !blob.size) throw new Error("The hue reference is not a valid image.");
      return blob;
    },
  });
}

export function useAddressAttachmentMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fileID }: { id: string; fileID: string | null }) => api.patchAddressAttachment(id, fileID),
    onSuccess: async (record) => {
      await client.cancelQueries({ queryKey: recordQueryKeys.address(record.id) });
      client.setQueryData(recordQueryKeys.address(record.id), record);
      await client.invalidateQueries({ queryKey: lifeQueryKeys.addresses, exact: true });
    },
  });
}
export function useAddressPatchMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<import("../types").Address> }) =>
      api.patchAddress(id, patch),
    onSuccess: async (record) => {
      client.setQueryData(recordQueryKeys.address(record.id), record);
      await client.invalidateQueries({ queryKey: lifeQueryKeys.addresses, exact: true });
    },
  });
}
export function useEducationPatchMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<import("../types").Education> }) =>
      api.patchEducation(id, patch),
    onSuccess: async (record) => {
      client.setQueryData(recordQueryKeys.education(record.id), record);
      await client.invalidateQueries({ queryKey: lifeQueryKeys.education, exact: true });
    },
  });
}
export function useEmploymentPatchMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<import("../types").Employment> }) =>
      api.patchEmployment(id, patch),
    onSuccess: async (record) => {
      client.setQueryData(recordQueryKeys.employment(record.id), record);
      await client.invalidateQueries({ queryKey: lifeQueryKeys.employment, exact: true });
    },
  });
}
export function useTransactionPatchMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<import("../types").ExpenseTransaction> }) =>
      api.patchTransaction(id, patch),
    onSuccess: async (record) => {
      client.setQueryData(recordQueryKeys.transaction(record.id), record);
      await client.invalidateQueries({ queryKey: lifeQueryKeys.transactions, exact: true });
    },
  });
}
export function useServiceAccountPatchMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<import("../types").ServiceAccount> }) =>
      api.patchServiceAccount(id, patch),
    onSuccess: async (record) => {
      client.setQueryData(recordQueryKeys.serviceAccount(record.id), record);
      await client.invalidateQueries({ queryKey: lifeQueryKeys.serviceAccounts, exact: true });
    },
  });
}
export function useTransactionImageMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fileID }: { id: string; fileID: string | null }) => api.patchTransactionImage(id, fileID),
    onSuccess: async (record) => {
      await client.cancelQueries({ queryKey: recordQueryKeys.transaction(record.id) });
      client.setQueryData(recordQueryKeys.transaction(record.id), record);
      await client.invalidateQueries({ queryKey: lifeQueryKeys.transactions, exact: true });
    },
  });
}
