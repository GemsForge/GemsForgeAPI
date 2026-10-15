import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { builderReducer, initialBuilderState, useSchemaBuilder } from "./useSchemaBuilder";
import { useAttachmentWorkflow } from "./useAttachmentWorkflow";
import { useLocalDatabaseForm } from "./useLocalDatabaseForm";
import type { UserTablePreview, HomeInventoryCSVPreview } from "../types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );
}
describe("feature workflow transitions", () => {
  it("does not upload a late native picker result after its view unmounts", async () => {
    const upload = vi.spyOn(api, "uploadImage");
    let choose!: (file: File) => void;
    const hook = renderHook(
      () => useAttachmentWorkflow({ label: "Image", ownerType: "Address", ownerID: "A", onAttach: vi.fn() }),
      { wrapper },
    );
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.choose(
        () =>
          new Promise((resolve) => {
            choose = resolve;
          }),
      );
    });
    hook.unmount();
    await act(async () => {
      choose(new File(["x"], "image.png", { type: "image/png" }));
      await pending;
    });
    expect(upload).not.toHaveBeenCalled();
  });
  it("requires fresh database confirmation when filename changes", async () => {
    vi.spyOn(api, "getLocalDatabaseCapabilities").mockResolvedValue({ profiles: [{ id: "test" }] } as Awaited<
      ReturnType<typeof api.getLocalDatabaseCapabilities>
    >);
    const create = vi.spyOn(api, "createLocalDatabase");
    const hook = renderHook(() => useLocalDatabaseForm({ onError: vi.fn(), onSuccess: vi.fn() }), { wrapper });
    await waitFor(() => expect(hook.result.current.selectedProfile?.id).toBe("test"));
    act(() => hook.result.current.setConfirmed(true));
    expect(hook.result.current.confirmed).toBe(true);
    act(() => hook.result.current.setDatabaseName("Other.sqlite"));
    expect(hook.result.current.confirmed).toBe(false);
    await act(async () => {
      await hook.result.current.createDatabase();
    });
    expect(create).not.toHaveBeenCalled();
  });
  it("invalidates table approvals when draft names or columns change", () => {
    const preview = {} as UserTablePreview;
    const approved = builderReducer(initialBuilderState, { type: "preview", value: preview, revision: 0 });
    expect(approved.preview).toBe(preview);
    expect(builderReducer(approved, { type: "tableName", value: "Changed" }).preview).toBeNull();
    expect(builderReducer(approved, { type: "columns", value: [] }).preview).toBeNull();
  });
  it("invalidates CSV approvals and ignores late preview responses", () => {
    const preview = { readyToImport: true } as HomeInventoryCSVPreview;
    const approved = builderReducer(initialBuilderState, { type: "csvPreview", value: preview, revision: 0 });
    const edited = builderReducer(approved, { type: "csv", value: "new CSV" });
    expect(edited.csvPreview).toBeNull();
    expect(builderReducer(edited, { type: "csvPreview", value: preview, revision: 0 })).toBe(edited);
    expect(builderReducer(edited, { type: "preview", value: {} as UserTablePreview, revision: 0 })).toBe(edited);
  });
  it("requires an approval before executing a table or CSV write", async () => {
    vi.spyOn(api, "getSchemaBuilderGuidance").mockResolvedValue(
      {} as Awaited<ReturnType<typeof api.getSchemaBuilderGuidance>>,
    );
    const table = vi.spyOn(api, "createUserTable");
    const csv = vi.spyOn(api, "importHomeInventoryCSV");
    const hook = renderHook(() => useSchemaBuilder({ onError: vi.fn(), onSuccess: vi.fn() }), { wrapper });
    await act(async () => {
      await hook.result.current.createTable();
      await hook.result.current.importCSV();
    });
    expect(table).not.toHaveBeenCalled();
    expect(csv).not.toHaveBeenCalled();
  });
  it("treats picker cancellation as a no-op and rejects non-images", async () => {
    const upload = vi.spyOn(api, "uploadImage");
    const onAttach = vi.fn();
    const hook = renderHook(
      () => useAttachmentWorkflow({ label: "Receipt image", ownerType: "ExpenseTransaction", ownerID: "T", onAttach }),
      { wrapper },
    );
    await act(async () => {
      await hook.result.current.choose(async () => null);
    });
    expect(hook.result.current.error).toBeNull();
    await act(async () => {
      await hook.result.current.handleFile(new File(["x"], "bad.txt", { type: "text/plain" }));
    });
    expect(hook.result.current.error).toContain("non-empty image");
    expect(upload).not.toHaveBeenCalled();
    expect(onAttach).not.toHaveBeenCalled();
  });
  it("prevents duplicate attachment writes and retains recoverable errors", async () => {
    let reject!: (error: Error) => void;
    const onAttach = vi.fn().mockReturnValue(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    const hook = renderHook(
      () => useAttachmentWorkflow({ label: "Address image", ownerType: "Address", ownerID: "A", onAttach }),
      { wrapper },
    );
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.remove();
      void hook.result.current.remove();
    });
    await waitFor(() => expect(hook.result.current.busy).toBe(true));
    expect(onAttach).toHaveBeenCalledOnce();
    await act(async () => {
      reject(new Error("Could not save"));
      await pending;
    });
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.error).toBe("Could not save");
  });
});
