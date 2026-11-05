import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import type { ServiceAccount, ServiceLogo } from "../../types";
import { useServiceAccountLogoURLs } from "./useServiceAccountLogoURLs";

const record = (overrides: Partial<ServiceAccount> = {}): ServiceAccount => ({
  id: 7,
  service: "Internet",
  logoKey: null,
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

const legacyLogo: ServiceLogo = {
  id: 42,
  logoKey: "INTERNET_LOGO",
  mimeType: "image/png",
  fileName: "internet.png",
  fileSizeBytes: 10,
  fileMetadataID: null,
  imagePath: "/service-logos/42/image",
};

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
  it("loads the current attachment-backed logo by FileMetadataID", async () => {
    const loadFile = vi.spyOn(api, "getFileContent").mockResolvedValue(new Blob(["image"], { type: "image/png" }));
    const loadLegacy = vi.spyOn(api, "getServiceLogoImage");
    const { result, unmount } = renderHook(() =>
      useServiceAccountLogoURLs(
        [record({ logoFileMetadataID: "file-logo-7", logoKey: "INTERNET_LOGO" })],
        [legacyLogo],
      ),
    );

    await waitFor(() => expect(result.current[7]).toBe("blob:service-logo"));
    expect(loadFile).toHaveBeenCalledWith("file-logo-7", expect.any(AbortSignal));
    expect(loadLegacy).not.toHaveBeenCalled();

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:service-logo");
  });

  it("falls back to the legacy logo asset when no attachment is stored", async () => {
    const loadLegacy = vi
      .spyOn(api, "getServiceLogoImage")
      .mockResolvedValue(new Blob(["image"], { type: "image/png" }));
    const { result } = renderHook(() =>
      useServiceAccountLogoURLs([record({ logoKey: "INTERNET_LOGO" })], [legacyLogo]),
    );

    await waitFor(() => expect(result.current[7]).toBe("blob:service-logo"));
    expect(loadLegacy).toHaveBeenCalledWith(42, expect.any(AbortSignal));
  });

  it("falls back to the legacy asset when the stored file cannot be read", async () => {
    vi.spyOn(api, "getFileContent").mockRejectedValue(new Error("Missing attachment"));
    const loadLegacy = vi
      .spyOn(api, "getServiceLogoImage")
      .mockResolvedValue(new Blob(["image"], { type: "image/png" }));
    const { result } = renderHook(() =>
      useServiceAccountLogoURLs(
        [record({ logoFileMetadataID: "file-logo-7", logoKey: "INTERNET_LOGO" })],
        [legacyLogo],
      ),
    );

    await waitFor(() => expect(result.current[7]).toBe("blob:service-logo"));
    expect(loadLegacy).toHaveBeenCalledWith(42, expect.any(AbortSignal));
  });
});
