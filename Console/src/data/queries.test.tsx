import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import {
  recordQueryKeys,
  useAddressQuery,
  useAddressAttachmentMutation,
  useCreateAddressMutation,
  useTransactionImageMutation,
} from "./recordQueries";
import { lifeQueryKeys } from "./lifeQueries";
import { usePageMutation, useCreateTableMutation, workflowQueryKeys } from "./workflowQueries";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("shared query and mutation layer", () => {
  it("does not request unselected records and isolates detail caches by ID", async () => {
    const get = vi
      .spyOn(api, "getAddress")
      .mockImplementation(async (id) => ({ id }) as Awaited<ReturnType<typeof api.getAddress>>);
    const { wrapper } = setup();
    const hook = renderHook(({ id }: { id: string | null }) => useAddressQuery(id), {
      wrapper,
      initialProps: { id: null } as { id: string | null },
    });
    expect(get).not.toHaveBeenCalled();
    hook.rerender({ id: "A" });
    await waitFor(() => expect(hook.result.current.data?.id).toBe("A"));
    hook.rerender({ id: "B" });
    await waitFor(() => expect(hook.result.current.data?.id).toBe("B"));
    hook.rerender({ id: "A" });
    expect(hook.result.current.data?.id).toBe("A");
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  });

  it("cancels an obsolete detail request when selection changes", async () => {
    const get = vi.spyOn(api, "getAddress").mockImplementation(() => new Promise(() => {}));
    const { wrapper } = setup();
    const hook = renderHook(({ id }) => useAddressQuery(id), { wrapper, initialProps: { id: "A" } });
    await waitFor(() => expect(get).toHaveBeenCalledOnce());
    const signal = get.mock.calls[0][1]!;
    hook.rerender({ id: "B" });
    expect(signal.aborted).toBe(true);
  });

  it("writes attachment responses to detail cache and invalidates the list", async () => {
    const record = { id: "A", imageFileMetadataID: "file-2" } as Awaited<ReturnType<typeof api.getAddress>>;
    vi.spyOn(api, "patchAddressAttachment").mockResolvedValue(record);
    const { client, wrapper } = setup();
    client.setQueryData(lifeQueryKeys.addresses, []);
    const hook = renderHook(() => useAddressAttachmentMutation(), { wrapper });
    await act(async () => {
      await hook.result.current.mutateAsync({ id: "A", fileID: "file-2" });
    });
    expect(client.getQueryData(recordQueryKeys.address("A"))).toEqual(record);
    expect(client.getQueryState(lifeQueryKeys.addresses)?.isInvalidated).toBe(true);
  });

  it("caches a created record and invalidates the list for refresh", async () => {
    const record = { id: "new-address", city: "Boston" } as Awaited<ReturnType<typeof api.createAddress>>;
    vi.spyOn(api, "createAddress").mockResolvedValue(record);
    const { client, wrapper } = setup();
    client.setQueryData(lifeQueryKeys.addresses, []);
    const hook = renderHook(() => useCreateAddressMutation(), { wrapper });
    await act(async () => {
      await hook.result.current.mutateAsync({
        id: "new-address",
        addressType: "Residence",
        addressLine1: null,
        addressLine2: null,
        city: "Boston",
        state: null,
        postalCode: null,
        country: "US",
        startDate: null,
        endDate: null,
        addressStatus: "Current",
        notes: null,
      });
    });
    expect(client.getQueryData(recordQueryKeys.address("new-address"))).toEqual(record);
    expect(client.getQueryState(lifeQueryKeys.addresses)?.isInvalidated).toBe(true);
  });

  it("removes receipt references and does not corrupt cache on failure", async () => {
    const record = { id: "T", image: null } as Awaited<ReturnType<typeof api.getTransaction>>;
    const patch = vi
      .spyOn(api, "patchTransactionImage")
      .mockResolvedValueOnce(record)
      .mockRejectedValueOnce(new Error("Rejected"));
    const { client, wrapper } = setup();
    const hook = renderHook(() => useTransactionImageMutation(), { wrapper });
    await act(async () => {
      await hook.result.current.mutateAsync({ id: "T", fileID: null });
    });
    expect(patch).toHaveBeenCalledWith("T", null);
    await act(async () => {
      await expect(hook.result.current.mutateAsync({ id: "T", fileID: "bad" })).rejects.toThrow("Rejected");
    });
    expect(client.getQueryData(recordQueryKeys.transaction("T"))).toEqual(record);
  });

  it("invalidates all page scopes and schema after successful writes", async () => {
    vi.spyOn(api, "patchPage").mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof api.patchPage>>);
    vi.spyOn(api, "createUserTable").mockResolvedValue({ table: "Inventory" } as Awaited<
      ReturnType<typeof api.createUserTable>
    >);
    const { client, wrapper } = setup();
    const key = workflowQueryKeys.pageList({ kind: "roots" });
    client.setQueryData(key, []);
    client.setQueryData(workflowQueryKeys.schema, {});
    const hook = renderHook(() => ({ page: usePageMutation(), table: useCreateTableMutation() }), { wrapper });
    await act(async () => {
      await hook.result.current.page.mutateAsync({
        id: 1,
        patch: { title: "Updated" },
      });
      await hook.result.current.table.mutateAsync("confirmed-token");
    });
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(workflowQueryKeys.schema)?.isInvalidated).toBe(true);
  });
});
