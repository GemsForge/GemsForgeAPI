import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { TamaguiProvider } from "tamagui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, APIError } from "../api";
import { tamaguiConfig } from "../design-system";
import type { FileMetadata } from "../types";
import { AttachmentControl } from "./AttachmentControl";
import { FilePresentation } from "./FilePresentation";

const metadata: FileMetadata = {
  id: "file-1", relativePath: "uploads/receipt.png", fileName: "receipt.png",
  fileKind: "receipt", mimeType: "image/png", byteSize: 1024,
  ownerType: "ExpenseTransaction", ownerID: "transaction-1",
};

function renderUI(element: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={client}><TamaguiProvider config={tamaguiConfig} defaultTheme="dark">{children}</TamaguiProvider></QueryClientProvider>;
  return render(element, { wrapper });
}

beforeEach(() => {
  vi.spyOn(api, "getFileMetadata").mockResolvedValue({ ...metadata });
  vi.spyOn(api, "getFileContent").mockResolvedValue(new Blob(["image"], { type: "image/png" }));
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => "blob:preview");
    static revokeObjectURL = vi.fn();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("FilePresentation", () => {
  it("shows an empty state without requesting a file", () => {
    renderUI(<FilePresentation label="Receipt image" />);
    expect(screen.getByText("No file attached")).toBeInTheDocument();
    expect(api.getFileMetadata).not.toHaveBeenCalled();
    expect(api.getFileContent).not.toHaveBeenCalled();
  });

  it("announces metadata loading", () => {
    vi.mocked(api.getFileMetadata).mockReturnValue(new Promise(() => {}));
    renderUI(<FilePresentation fileMetadataID="file-1" label="Receipt image" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading file details");
  });

  it("shows metadata, waits for image decoding, and releases the preview on unmount", async () => {
    const view = renderUI(<FilePresentation fileMetadataID="file-1" label="Receipt image" />);
    expect(await screen.findByText("receipt.png")).toBeInTheDocument();
    expect(screen.getByText("1,024 bytes")).toBeInTheDocument();
    const image = await screen.findByAltText("Receipt image preview");
    expect(image).not.toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Loading image preview");
    fireEvent.load(image);
    expect(image).toBeVisible();
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("distinguishes missing metadata from a temporarily unavailable API", async () => {
    vi.mocked(api.getFileMetadata).mockRejectedValueOnce(new APIError("Not found", 404));
    renderUI(<FilePresentation fileMetadataID="file-1" label="Receipt image" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("File record not found");
    fireEvent.click(screen.getByRole("button", { name: "Retry file details" }));
    expect(await screen.findByText("receipt.png")).toBeInTheDocument();
  });

  it("retains metadata when the stored file is missing and allows retry", async () => {
    vi.mocked(api.getFileContent).mockRejectedValueOnce(new APIError("Missing", 404));
    renderUI(<FilePresentation fileMetadataID="file-1" label="Receipt image" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("missing from storage");
    expect(screen.getByText("receipt.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry image preview" }));
    const image = await screen.findByAltText("Receipt image preview");
    fireEvent.load(image);
    expect(image).toBeVisible();
  });

  it("reports an invalid image when decoding fails", async () => {
    renderUI(<FilePresentation fileMetadataID="file-1" label="Receipt image" />);
    fireEvent.error(await screen.findByAltText("Receipt image preview"));
    expect(screen.getByRole("alert")).toHaveTextContent("damaged or unsupported");
    expect(screen.queryByAltText("Receipt image preview")).not.toBeInTheDocument();
  });

  it.each([new Blob([], { type: "image/png" }), new Blob(["<html>"], { type: "text/html" })])(
    "rejects empty or non-image content despite image metadata", async (blob) => {
      vi.mocked(api.getFileContent).mockResolvedValue(blob);
      renderUI(<FilePresentation fileMetadataID="file-1" label="Receipt image" />);
      expect(await screen.findByRole("alert")).toHaveTextContent("cannot be displayed as an image");
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    },
  );

  it("shows non-image metadata without fetching preview bytes", async () => {
    vi.mocked(api.getFileMetadata).mockResolvedValue({ ...metadata, fileName: null,
      mimeType: "application/pdf", byteSize: null, relativePath: "documents/receipt.pdf" });
    renderUI(<FilePresentation fileMetadataID="file-1" label="Receipt document" />);
    expect(await screen.findByText("receipt.pdf")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("not available for this file type");
    expect(api.getFileContent).not.toHaveBeenCalled();
  });

  it("aborts an old request and ignores its result after selecting another record", async () => {
    let resolveOld!: (value: Blob) => void;
    vi.mocked(api.getFileContent).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const view = renderUI(<FilePresentation fileMetadataID="file-1" label="Receipt image" />);
    await waitFor(() => expect(api.getFileContent).toHaveBeenCalledOnce());
    const signal = vi.mocked(api.getFileContent).mock.calls[0][1];
    view.rerender(<FilePresentation fileMetadataID={null} label="Receipt image" />);
    expect(signal.aborted).toBe(true);
    await act(async () => resolveOld(new Blob(["old"], { type: "image/png" })));
    expect(screen.getByText("No file attached")).toBeInTheDocument();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("shows retryable network errors distinctly from missing files", async () => {
    vi.mocked(api.getFileContent).mockRejectedValue(new TypeError("Offline"));
    renderUI(<FilePresentation fileMetadataID="file-1" label="Receipt image" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
  });
});

describe("AttachmentControl selection boundary", () => {
  const props = { fileMetadataID: null, ownerType: "ExpenseTransaction", ownerID: "transaction-1", label: "Receipt image" };

  it("accepts a File from a future native picker adapter and preserves upload ownership", async () => {
    const file = new File(["image"], "receipt.png", { type: "image/png" });
    const upload = vi.spyOn(api, "uploadImage").mockResolvedValue(metadata);
    const attach = vi.fn().mockResolvedValue(undefined);
    renderUI(<AttachmentControl {...props} onAttach={attach} selectImage={async () => file} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose image" }));
    await waitFor(() => expect(attach).toHaveBeenCalledWith(metadata));
    expect(upload).toHaveBeenCalledWith(file, "receipt-image", "ExpenseTransaction", "transaction-1");
  });

  it("treats native picker cancellation as no change", async () => {
    const upload = vi.spyOn(api, "uploadImage");
    const attach = vi.fn();
    renderUI(<AttachmentControl {...props} onAttach={attach} selectImage={async () => null} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose image" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose image" })).toBeEnabled());
    expect(upload).not.toHaveBeenCalled(); expect(attach).not.toHaveBeenCalled();
  });

  it("validates browser-selected files before uploading", async () => {
    const upload = vi.spyOn(api, "uploadImage");
    renderUI(<AttachmentControl {...props} onAttach={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Choose receipt image"), {
      target: { files: [new File(["text"], "receipt.txt", { type: "text/plain" })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a non-empty image file");
    expect(upload).not.toHaveBeenCalled();
  });

  it("detaches only the reference when removing a file", async () => {
    const attach = vi.fn().mockResolvedValue(undefined);
    renderUI(<AttachmentControl {...props} fileMetadataID="file-1" onAttach={attach} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(attach).toHaveBeenCalledWith(null));
  });
});
