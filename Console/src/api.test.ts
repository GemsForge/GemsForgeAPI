import { afterEach, describe, expect, it, vi } from "vitest";
import { api, APIError } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("standardized API failures", () => {
  it("normalizes offline failures without hiding cancellation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network failed")));
    await expect(api.listDomains()).rejects.toMatchObject({ name: "APIError", status: 0 });
    const controller = new AbortController();
    controller.abort();
    const error = new DOMException("Cancelled", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(api.listDomains(controller.signal)).rejects.toBe(error);
  });
  it("retains upload HTTP status and lets fetch set multipart boundaries", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("not JSON", { status: 413, statusText: "Too large" }));
    vi.stubGlobal("fetch", fetch);
    await expect(api.uploadImage(new File(["x"], "image.png"), "image", "Address", "A")).rejects.toMatchObject({
      status: 413,
      message: "413 Too large",
    });
    expect(fetch.mock.calls[0][1].headers).toBeUndefined();
    expect(fetch.mock.calls[0][1].body).toBeInstanceOf(FormData);
  });
});

describe("resource create contracts", () => {
  it("posts only the explicit resource payload to each create route", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(
        async (_path: string, options: RequestInit) =>
          new Response(options.body, { headers: { "Content-Type": "application/json" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const payloads = [
      [api.createDomain, "/domains", { title: "Home", description: "Personal domain" }],
      [
        api.createAddress,
        "/addresses",
        { id: "A1", addressType: "Residence", country: "US", addressStatus: "Current" },
      ],
      [
        api.createEducation,
        "/education",
        { id: "E1", educationType: "Degree", institutionName: "School", status: "Completed", locationAddressID: "A1" },
      ],
      [
        api.createEmployment,
        "/employment",
        {
          id: "W1",
          employerName: "Org",
          employerType: "Company",
          positionTitle: "Engineer",
          employmentType: "Full-time",
          employmentStatus: "Current",
          workAddressID: "A1",
        },
      ],
      [
        api.createTransaction,
        "/transactions",
        { id: "T1", item: "Book", firstReceiptItem: true, categoryID: 3, subcategoryID: null, quantity: 1 },
      ],
      [api.createServiceAccount, "/service-accounts", { service: "Internet", monthlyAmount: 50 }],
    ] as const;
    for (const [create, path, payload] of payloads) {
      await create(payload as never);
      const [, options] = fetch.mock.calls.at(-1)!;
      expect(fetch.mock.calls.at(-1)?.[0]).toBe(path);
      expect(options.method).toBe("POST");
      expect(JSON.parse(String(options.body))).toEqual(payload);
      expect(JSON.parse(String(options.body))).not.toHaveProperty("createdAt");
    }
  });
});

describe("file presentation API", () => {
  it("encodes metadata IDs and forwards cancellation", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "file/1" })));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    expect(await api.getFileMetadata("file/1", controller.signal)).toEqual({ id: "file/1" });
    expect(fetch).toHaveBeenCalledWith(
      "/file-metadata/file%2F1",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("retains the HTTP status when metadata is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ reason: "Missing" }), { status: 404 })),
    );
    await expect(api.getFileMetadata("missing")).rejects.toMatchObject({ status: 404, message: "Missing" });
  });

  it("reads preview bytes through the safe content endpoint", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("image", { headers: { "Content-Type": "image/png" } }));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    const blob = await api.getFileContent("file/1", signal);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(5);
    expect(fetch).toHaveBeenCalledWith("/file-metadata/file%2F1/content", { signal, cache: "no-store" });
  });

  it("distinguishes a missing stored file from decoding failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(api.getFileContent("missing", new AbortController().signal)).rejects.toBeInstanceOf(APIError);
  });
});
