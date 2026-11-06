import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import type { ServiceAccount } from "../../types";
import { useServiceAccountLogoURLs } from "./useServiceAccountLogoURLs";

const record = (overrides: Partial<ServiceAccount> = {}): ServiceAccount => ({
  id: 7,
  service: "Internet",
  type: "Utility",
  expenseGroup: "Home",
  monthlyAmount: null,
  interestRate: null,
  apr: null,
  due: null,
  occurrence: null,
  status: "Active",
  since: null,
  website: null,
  notes: null,
  notionPage: null,
  paymentMethod: null,
  accountNumber: null,
  emailUpdated: null,
  associatedAddress: null,
  serviceKey: null,
  logoFileMetadataID: null,
  ...overrides,
});

beforeEach(() => {
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:service-logo");
      static revokeObjectURL = vi.fn();
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useServiceAccountLogoURLs", () => {
  it("loads each logo directly by FileMetadataID", async () => {
    const loadFile = vi.spyOn(api, "getFileContent").mockResolvedValue(new Blob(["image"], { type: "image/png" }));
    const { result, unmount } = renderHook(() =>
      useServiceAccountLogoURLs([record({ logoFileMetadataID: "file-logo-7" })]),
    );

    await waitFor(() => expect(result.current[7]).toBe("blob:service-logo"));
    expect(loadFile).toHaveBeenCalledWith("file-logo-7", expect.any(AbortSignal));

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:service-logo");
  });

  it("does not request a logo when a record has no FileMetadata reference", async () => {
    const loadFile = vi.spyOn(api, "getFileContent");
    const { result } = renderHook(() => useServiceAccountLogoURLs([record()]));

    await waitFor(() => expect(result.current).toEqual({}));
    expect(loadFile).not.toHaveBeenCalled();
  });
});
