import { afterEach, describe, expect, it, vi } from "vitest";
import { api, APIError } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("file presentation API", () => {
  it("encodes metadata IDs and forwards cancellation", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "file/1" })));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    expect(await api.getFileMetadata("file/1", controller.signal)).toEqual({ id: "file/1" });
    expect(fetch).toHaveBeenCalledWith("/file-metadata/file%2F1", expect.objectContaining({ signal: controller.signal }));
  });

  it("retains the HTTP status when metadata is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ reason: "Missing" }), { status: 404 })));
    await expect(api.getFileMetadata("missing")).rejects.toMatchObject({ status: 404, message: "Missing" });
  });

  it("reads preview bytes through the safe content endpoint", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("image", { headers: { "Content-Type": "image/png" } }));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    const blob = await api.getFileContent("file/1", signal);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(5);
    expect(fetch).toHaveBeenCalledWith("/file-metadata/file%2F1/content", { signal });
  });

  it("distinguishes a missing stored file from decoding failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(api.getFileContent("missing", new AbortController().signal)).rejects.toBeInstanceOf(APIError);
  });
});
