import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import {
  presentationQueryKeys,
  useDeleteRecordPresentationMutation,
  useRecordPresentationsQuery,
  useSaveRecordPresentationMutation,
  useTableViewsQuery,
} from "./presentationQueries";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("presentation server state", () => {
  it("loads saved inspector selection and display state through the table view cache", async () => {
    vi.spyOn(api, "getTableView").mockImplementation(async (_table, viewType) => ({
      view: {
        viewID: viewType,
        tableName: "Addresses",
        name: viewType,
        viewType,
        workspaceState:
          viewType === "Gallery"
            ? JSON.stringify({ activeViewId: "gallery", selectedRecordId: "ADDR-1", galleryCardSize: "medium" })
            : null,
        updatedAt: "2026-11-02T12:00:00Z",
      },
      columns: [],
      queries: [],
    }));
    const { wrapper } = setup();
    const hook = renderHook(() => useTableViewsQuery("Addresses"), { wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(JSON.parse(hook.result.current.data!.Gallery!.view.workspaceState!)).toMatchObject({
      selectedRecordId: "ADDR-1",
      galleryCardSize: "medium",
    });
  });

  it("caches cover changes, removes them, and rolls a failed mutation back", async () => {
    const tableName = "Addresses";
    const queryKey = presentationQueryKeys.recordPresentations(tableName);
    const oldCover = { recordID: "ADDR-1", presentation: '{"source":"color"}' };
    let serverState = [oldCover];
    vi.spyOn(api, "listRecordPresentations").mockImplementation(async () => serverState);
    vi.spyOn(api, "saveRecordPresentation").mockImplementation(async (_table, recordID, presentation) => {
      serverState = [{ recordID, presentation }];
      return { recordID, presentation };
    });
    const remove = vi.spyOn(api, "deleteRecordPresentation").mockImplementation(async () => {
      serverState = [];
    });
    const { client, wrapper } = setup();
    client.setQueryData(queryKey, [oldCover]);
    const read = renderHook(() => useRecordPresentationsQuery(tableName), { wrapper });
    await waitFor(() => expect(read.result.current.data).toEqual([oldCover]));

    const save = renderHook(() => useSaveRecordPresentationMutation(tableName), { wrapper });
    await act(async () =>
      save.result.current.mutateAsync({ recordID: "ADDR-1", presentation: '{"source":"gallery"}' }),
    );
    expect(client.getQueryData(queryKey)).toEqual([{ recordID: "ADDR-1", presentation: '{"source":"gallery"}' }]);

    const deleteCover = renderHook(() => useDeleteRecordPresentationMutation(tableName), { wrapper });
    await act(async () => deleteCover.result.current.mutateAsync("ADDR-1"));
    expect(remove).toHaveBeenCalledWith("Addresses", "ADDR-1");
    expect(client.getQueryData(queryKey)).toEqual([]);

    serverState = [oldCover];
    client.setQueryData(queryKey, [oldCover]);
    vi.mocked(api.saveRecordPresentation).mockRejectedValueOnce(new Error("Save failed"));
    await act(async () => {
      await expect(
        save.result.current.mutateAsync({ recordID: "ADDR-1", presentation: '{"source":"url"}' }),
      ).rejects.toThrow("Save failed");
    });
    await waitFor(() => expect(client.getQueryData(queryKey)).toEqual([oldCover]));
  });
});
