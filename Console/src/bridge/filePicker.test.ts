import { afterEach, describe, expect, it, vi } from "vitest";
import { hasNativeFilePicker, pickNativeFile } from "./filePicker";
import type { GemLifeBridgeMessage } from "./index";

afterEach(() => {
  delete window.webkit;
  vi.useRealTimers();
});
function native() {
  const postMessage = vi.fn();
  window.webkit = { messageHandlers: { gemLife: { postMessage } } };
  return postMessage;
}
function reply(requestID: string, payload: Record<string, string>, type: GemLifeBridgeMessage["type"] = "localFile") {
  window.dispatchEvent(new CustomEvent("gem-life-native-message", { detail: { type, requestID, payload } }));
}
describe("native file boundary", () => {
  it("fails safely outside the native host", async () => {
    expect(hasNativeFilePicker()).toBe(false);
    await expect(pickNativeFile()).rejects.toThrow("unavailable");
  });
  it("returns only selected bytes and matches request IDs", async () => {
    const post = native();
    const pending = pickNativeFile();
    const message = post.mock.calls[0][0];
    expect(message.type).toBe("requestImage");
    expect(message.payload).toBeUndefined();
    reply("unrelated", { cancelled: "true" });
    reply(message.requestID, { name: "image.png", mimeType: "image/png", base64: btoa("image") });
    const file = await pending;
    expect(file?.name).toBe("image.png");
    expect(file?.size).toBe(5);
  });
  it("resolves cancellation without inventing a file", async () => {
    const post = native();
    const pending = pickNativeFile();
    reply(post.mock.calls[0][0].requestID, { cancelled: "true" });
    expect(await pending).toBeNull();
  });
  it("rejects path disclosure and unsupported data", async () => {
    const post = native();
    const pending = pickNativeFile();
    reply(post.mock.calls[0][0].requestID, { name: "/private/secret", mimeType: "image/png", base64: btoa("x") });
    await expect(pending).rejects.toThrow("Invalid native file");
  });
  it("cleans up after errors and timeouts", async () => {
    vi.useFakeTimers();
    const post = native();
    const pending = pickNativeFile();
    reply(post.mock.calls[0][0].requestID, { message: "Denied" }, "error");
    await expect(pending).rejects.toThrow("Denied");
    const timeout = pickNativeFile();
    const expectation = expect(timeout).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(120_000);
    await expectation;
    expect(vi.getTimerCount()).toBe(0);
  });
});
