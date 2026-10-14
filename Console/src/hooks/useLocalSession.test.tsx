import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { useLocalSession } from "./useLocalSession";
import { LocalSession } from "../components/LocalSession";

beforeEach(() => { vi.spyOn(api, "getHealth").mockResolvedValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete window.webkit; });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
describe("device-local session lifecycle", () => {
  it("clears personal cache, cancels reads, and resumes without an account", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(["addresses"], [{ id: "private-record" }]);
    const hook = renderHook(useLocalSession, { wrapper });
    await waitFor(() => expect(hook.result.current.health.data).toBe(true));
    let signal!: AbortSignal;
    void client.fetchQuery({ queryKey: ["pending-record"], queryFn: (context) => { signal = context.signal; return new Promise(() => {}); } }).catch(() => {});
    await act(async () => { expect(await hook.result.current.end()).toBe(true); });
    expect(signal.aborted).toBe(true);
    expect(hook.result.current.active).toBe(false);
    expect(client.getQueryData(["addresses"])).toBeUndefined();
    act(() => hook.result.current.resume());
    expect(hook.result.current.active).toBe(true);
    await waitFor(() => expect(api.getHealth).toHaveBeenCalledTimes(2));
  });
  it("refuses to end during a pending write", async () => {
    const { client, wrapper } = setup();
    let finish!: () => void;
    const mutation = client.getMutationCache().build(client, { mutationFn: () => new Promise<void>((resolve) => { finish = resolve; }) });
    const hook = renderHook(useLocalSession, { wrapper });
    let pending!: Promise<unknown>;
    act(() => { pending = mutation.execute(undefined); });
    await waitFor(() => expect(client.isMutating()).toBe(1));
    await act(async () => { expect(await hook.result.current.end()).toBe(false); });
    expect(hook.result.current.active).toBe(true);
    expect(hook.result.current.error).toContain("save to finish");
    await act(async () => { finish(); await pending; });
  });
  it("notifies the native boundary without credentials or paths", async () => {
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { gemLife: { postMessage } } };
    const { wrapper } = setup();
    const hook = renderHook(useLocalSession, { wrapper });
    await act(async () => { await hook.result.current.end(); });
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "session", payload: { action: "end" } }));
  });
  it("unmounts drafts on end and shows honest offline feedback", async () => {
    vi.mocked(api.getHealth).mockRejectedValue(new Error("Offline"));
    const { wrapper } = setup();
    render(<LocalSession><label>Draft<input defaultValue="" /></label></LocalSession>, { wrapper });
    expect(await screen.findByText("Local API unavailable")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "Unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: "End local session" }));
    await screen.findByRole("heading", { name: "Local workspace ended" });
    expect(screen.queryByLabelText("Draft")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open local workspace" }));
    expect(screen.getByLabelText("Draft")).toHaveValue("");
  });
});
