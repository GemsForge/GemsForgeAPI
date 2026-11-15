import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "@gemsforge/ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APIError, api } from "../../api";
import { WireframeRecordBody, safeMarkdownURL } from "./WireframeRecordBody";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function renderBody() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <QueryClientProvider client={client}>
        <WireframeRecordBody tableName="Addresses" recordID="ADDR-1" />
      </QueryClientProvider>
    </TamaguiProvider>,
  );
}

describe("record Markdown body", () => {
  it("renders Markdown safely and rejects unsafe link protocols and raw HTML", async () => {
    vi.spyOn(api, "getRecordBody").mockResolvedValue({
      recordID: "ADDR-1",
      markdown: "<script>alert(1)</script>\n\n[jump](javascript:alert%281%29)\n\n[ok](https://example.com)",
      revision: 2,
      updatedAt: null,
    });
    vi.spyOn(api, "saveRecordBody");
    const { container } = renderBody();
    await screen.findByLabelText("Page content (Markdown)");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("a[href^='javascript:']")).toBeNull();
    expect(container.querySelector("a[href='https://example.com']")).toBeInTheDocument();
    expect(safeMarkdownURL("mailto:test@example.com")).toBe("mailto:test@example.com");
    expect(safeMarkdownURL("javascript:alert(1)")).toBe("");
    expect(safeMarkdownURL("data:image/png;base64,AA")).toBe("");
    expect(safeMarkdownURL("/file-metadata/abc_123/content")).toBe("/file-metadata/abc_123/content");
    expect(safeMarkdownURL("/other/path")).toBe("");
    expect(safeMarkdownURL("relative/path")).toBe("");
    expect(safeMarkdownURL("//example.com/path")).toBe("");
  });

  it("debounces autosave and saves immediately on blur", async () => {
    vi.spyOn(api, "getRecordBody").mockResolvedValue({
      recordID: "ADDR-1",
      markdown: "",
      revision: 0,
      updatedAt: null,
    });
    const save = vi
      .spyOn(api, "saveRecordBody")
      .mockResolvedValue({ recordID: "ADDR-1", markdown: "written", revision: 1, updatedAt: null });
    renderBody();
    const editor = await screen.findByLabelText("Page content (Markdown)");
    await act(async () => {
      fireEvent.change(editor, { target: { value: "written" } });
    });
    expect(save).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 850));
    await waitFor(() => expect(save).toHaveBeenCalledWith("Addresses", "ADDR-1", "written", 0));
  });

  it("saves edits made while an earlier autosave is in flight", async () => {
    vi.spyOn(api, "getRecordBody").mockResolvedValue({
      recordID: "ADDR-1",
      markdown: "",
      revision: 0,
      updatedAt: null,
    });
    let resolveFirst!: (value: { recordID: string; markdown: string; revision: number; updatedAt: null }) => void;
    const firstSave = new Promise<{ recordID: string; markdown: string; revision: number; updatedAt: null }>(
      (resolve) => {
        resolveFirst = resolve;
      },
    );
    const save = vi
      .spyOn(api, "saveRecordBody")
      .mockReturnValueOnce(firstSave)
      .mockResolvedValue({ recordID: "ADDR-1", markdown: "latest", revision: 2, updatedAt: null });
    renderBody();
    const editor = await screen.findByLabelText("Page content (Markdown)");
    fireEvent.change(editor, { target: { value: "first" } });
    await new Promise((resolve) => setTimeout(resolve, 850));
    expect(save).toHaveBeenCalledTimes(1);

    fireEvent.change(editor, { target: { value: "latest" } });
    await new Promise((resolve) => setTimeout(resolve, 850));
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst({ recordID: "ADDR-1", markdown: "first", revision: 1, updatedAt: null });
      await firstSave;
    });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith("Addresses", "ADDR-1", "latest", 1));
    expect(editor).toHaveValue("latest");
  });

  it("autosaves a pasted image after upload completes", async () => {
    vi.spyOn(api, "getRecordBody").mockResolvedValue({
      recordID: "ADDR-1",
      markdown: "",
      revision: 0,
      updatedAt: null,
    });
    vi.spyOn(api, "uploadImage").mockResolvedValue({
      id: "image-1",
      relativePath: "images/image-1.png",
      fileName: "image.png",
      fileKind: "image",
      mimeType: "image/png",
      byteSize: 10,
      ownerType: "RecordBody.Addresses",
      ownerID: "ADDR-1",
    });
    const save = vi.spyOn(api, "saveRecordBody").mockResolvedValue({
      recordID: "ADDR-1",
      markdown: "![image.png](/file-metadata/image-1/content)",
      revision: 1,
      updatedAt: null,
    });
    renderBody();
    const editor = await screen.findByLabelText("Page content (Markdown)");
    fireEvent.paste(editor, {
      clipboardData: { files: [new File(["image"], "image.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(editor).toHaveValue("![image.png](/file-metadata/image-1/content)"));
    await new Promise((resolve) => setTimeout(resolve, 850));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("Addresses", "ADDR-1", "![image.png](/file-metadata/image-1/content)", 0),
    );
  });

  it("offers remote or local content after a revision conflict", async () => {
    vi.spyOn(api, "getRecordBody").mockResolvedValue({
      recordID: "ADDR-1",
      markdown: "before",
      revision: 1,
      updatedAt: null,
    });
    const save = vi
      .spyOn(api, "saveRecordBody")
      .mockRejectedValueOnce(new APIError("Conflict", 409))
      .mockResolvedValue({ recordID: "ADDR-1", markdown: "mine", revision: 3, updatedAt: null });
    vi.mocked(api.getRecordBody)
      .mockResolvedValueOnce({ recordID: "ADDR-1", markdown: "before", revision: 1, updatedAt: null })
      .mockResolvedValue({ recordID: "ADDR-1", markdown: "remote", revision: 2, updatedAt: null });
    renderBody();
    const editor = await screen.findByLabelText("Page content (Markdown)");
    fireEvent.change(editor, { target: { value: "mine" } });
    fireEvent.blur(editor);
    expect(await screen.findByText(/changed elsewhere/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep mine" }));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith("Addresses", "ADDR-1", "mine", 2));
  });
});
