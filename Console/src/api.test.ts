import { afterEach, describe, expect, it, vi } from "vitest";
import { api, APIError } from "./api";
import { clearSession, saveSession } from "./auth/session";

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe("API bearer authentication", () => {
  it("signs in locally and attaches only the API session token to protected requests", async () => {
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

    await api.localSignIn("owner", "password");
    expect(fetch.mock.calls[0][0]).toBe("/auth/local");
    expect(fetch.mock.calls[0][1]?.method).toBe("POST");
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get("Authorization")).toBeNull();
    expect(fetch.mock.calls[0][1]?.body).toBe(JSON.stringify({ username: "owner", password: "password" }));

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
  it("loads schema-page navigation and Hub-scoped records through the API", async () => {
    const response = {
      table: {
        name: "FamilyGoals",
        columns: [{ name: "ID", dataType: "TEXT", nullable: false, primaryKey: true, defaultValue: null }],
      },
      rows: [{ ID: "goal-1", Goal: "Save for travel" }],
      totalCount: 1,
      limit: 100,
      offset: 0,
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ tables: [response.table], availableTables: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify(response)))
      .mockResolvedValueOnce(new Response(JSON.stringify(response.table)));
    vi.stubGlobal("fetch", fetch);

    await api.getSchemaPageTables();
    await expect(api.getSchemaPageRecords("Family Goals/2026", 100)).resolves.toEqual(response);
    await expect(api.createSchemaPage("Family Goals/2026")).resolves.toEqual(response.table);
    expect(fetch.mock.calls.map(([path]) => path)).toEqual([
      "/schema-builder/tables",
      "/schema-builder/tables/Family%20Goals%2F2026/records?limit=100&offset=100",
      "/schema-builder/tables/Family%20Goals%2F2026/page",
    ]);
    expect(fetch.mock.calls[2][1]?.method).toBe("POST");
  });

  it("creates one schema-backed record through its encoded Hub-scoped route", async () => {
    const created = { table: "Family Goals", recordID: "generated-id" };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(created)));
    vi.stubGlobal("fetch", fetch);
    await expect(api.createSchemaPageRecord("Family Goals", { Title: "Vacation", Count: 2 })).resolves.toEqual(created);
    expect(fetch.mock.calls[0]?.[0]).toBe("/schema-builder/tables/Family%20Goals/records");
    expect(fetch.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetch.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ Title: "Vacation", Count: 2 }));
  });

  it("patches schema-backed records through their Hub-scoped encoded route", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    await expect(api.patchSchemaPageRecord("Family Goals", "goal/1", { Quantity: 9 })).resolves.toBeNull();
    expect(fetch.mock.calls[0]?.[0]).toBe("/schema-builder/tables/Family%20Goals/records/goal%2F1");
    expect(fetch.mock.calls[0]?.[1]?.method).toBe("PATCH");
    expect(fetch.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ Quantity: 9 }));
  });

  it("loads exact related records, saves relation definitions, and requests searchable relation values", async () => {
    const relation = {
      id: "transaction-category",
      tableName: "Transactions",
      name: "Category",
      kind: "Relation" as const,
      sourceColumnName: "CategoryID",
      targetTableName: "BudgetCategories",
      targetKeyColumnName: "CategoryID",
      targetDisplayColumnName: "Category",
      relationDefinitionID: null,
      targetColumnName: null,
      filterByDefinitionID: null,
      targetFilterColumnName: null,
      sortOrder: 0,
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            table: { name: "BudgetCategories", columns: [] },
            row: { CategoryID: "1", Category: "Food" },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([relation])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "2", name: "Travel" }])))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ definitionID: relation.id, recordID: "1", displayValue: "Food", value: "Food" }]),
        ),
      );
    vi.stubGlobal("fetch", fetch);

    await expect(api.getSchemaPageRecord("BudgetCategories", "1")).resolves.toMatchObject({
      row: { Category: "Food" },
    });
    await expect(api.saveTablePropertyDefinitions("Transactions", [relation])).resolves.toEqual([relation]);
    await expect(api.getRelatedRecordOptions("Transactions", relation.id, "tra", "TRX-1")).resolves.toEqual([
      { id: "2", name: "Travel" },
    ]);
    await expect(api.getTablePropertyValues("Transactions", "TRX-1")).resolves.toMatchObject([
      { definitionID: relation.id, displayValue: "Food" },
    ]);
    expect(fetch.mock.calls.map(([path, options]) => [path, options?.method])).toEqual([
      ["/schema-builder/tables/BudgetCategories/records/1", undefined],
      ["/schema-builder/tables/Transactions/properties", "PUT"],
      [
        "/schema-builder/tables/Transactions/properties/transaction-category/options?search=tra&limit=50&recordID=TRX-1",
        undefined,
      ],
      ["/schema-builder/tables/Transactions/records/TRX-1/properties", undefined],
    ]);
  });

  it("uses the Hub-scoped archive lifecycle routes", async () => {
    const archived = {
      entryID: "entry-1",
      tableName: "Education",
      recordID: "EDU-1",
      title: "School",
      snapshot: '{"id":"EDU-1"}',
      trashedAt: null,
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(archived)))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);

    await expect(
      api.archiveRecord({
        tableName: "Education",
        recordID: "EDU-1",
        title: "School",
        snapshot: '{"id":"EDU-1"}',
      }),
    ).resolves.toEqual(archived);
    await api.restoreTrashEntry("entry-1");
    await api.permanentlyDeleteTrashEntry("entry-1");

    expect(fetch.mock.calls.map(([path, options]) => [path, options?.method])).toEqual([
      ["/trash", "POST"],
      ["/trash/entry-1/restore", "POST"],
      ["/trash/entry-1", "DELETE"],
    ]);
  });

  it("lists safe local database summaries without exposing filesystem paths", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([{ databaseName: "Dev.sqlite", fileSizeBytes: 42 }])));
    vi.stubGlobal("fetch", fetch);
    await expect(api.getLocalDatabases()).resolves.toEqual([{ databaseName: "Dev.sqlite", fileSizeBytes: 42 }]);
    expect(fetch.mock.calls[0][0]).toBe("/local-databases");
  });

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
