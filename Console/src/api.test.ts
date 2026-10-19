import { afterEach, describe, expect, it, vi } from "vitest";
import { api, APIError } from "./api";
import { clearSession, saveSession } from "./auth/session";

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe("API bearer authentication", () => {
  it("exchanges a Supabase access token for an opaque API session and attaches only the API token to protected requests", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sessionToken: "opaque-session",
            expiresAt: "2099-01-01T00:00:00Z",
          }),
        ),
      )
      .mockResolvedValueOnce(new Response("[]"));
    vi.stubGlobal("fetch", fetch);

    await api.exchangeSupabaseIdentityToken("supabase-access-token");
    expect(fetch.mock.calls[0][0]).toBe("/auth/supabase");
    expect(fetch.mock.calls[0][1]?.method).toBe("POST");
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer supabase-access-token");
    expect(fetch.mock.calls[0][1]?.body).toBeUndefined();

    saveSession({ token: "opaque-session", expiresAt: "2099-01-01T00:00:00Z" });
    await api.listDomains();
    expect(fetch.mock.calls[1][0]).toBe("/domains");
    expect(new Headers(fetch.mock.calls[1][1]?.headers).get("Authorization")).toBe("Bearer opaque-session");
    expect(String(fetch.mock.calls[1][0])).not.toContain("opaque-session");
  });

  it("clears a browser session when an authenticated endpoint reports expiry or revocation", async () => {
    saveSession({ token: "revoked-session", expiresAt: "2099-01-01T00:00:00Z" });
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ reason: "Unauthorized" }), { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    await expect(api.listDomains()).rejects.toMatchObject({ status: 401 });
    expect(window.sessionStorage.length).toBe(0);
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer revoked-session");
  });

  it("sends API logout with the bearer token before clearing it locally", async () => {
    saveSession({ token: "logout-session", expiresAt: "2099-01-01T00:00:00Z" });
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    await api.logout();
    expect(fetch.mock.calls[0][0]).toBe("/auth/logout");
    expect(fetch.mock.calls[0][1]?.method).toBe("POST");
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer logout-session");
  });
});

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
    expect(new Headers(fetch.mock.calls[0][1].headers).get("Content-Type")).toBeNull();
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
    expect(fetch).toHaveBeenCalledWith("/file-metadata/file%2F1/content", {
      signal,
      cache: "no-store",
      headers: expect.any(Headers),
    });
  });

  it("distinguishes a missing stored file from decoding failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(api.getFileContent("missing", new AbortController().signal)).rejects.toBeInstanceOf(APIError);
  });
});
