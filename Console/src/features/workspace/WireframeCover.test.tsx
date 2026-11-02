import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../../design-system";
import { validateCoverImageURL, WireframeCover } from "./WireframeCover";
import { api } from "../../api";

function renderCover(props: React.ComponentProps<typeof WireframeCover> = {}) {
  return render(<TamaguiProvider config={tamaguiConfig} defaultTheme="light"><WireframeCover {...props} /></TamaguiProvider>);
}

describe("WireframeCover", () => {
  it("renders a fallback and opens preset choices", async () => {
    renderCover();
    expect(document.querySelector(".wireframe-cover-visual")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change cover" }));
    expect(await screen.findByText("Color & gradient")).toBeInTheDocument();
    expect(document.querySelectorAll(".wireframe-cover-preset").length).toBeGreaterThan(0);
  });
  it("validates links and persists a preset", async () => {
    const onChange = vi.fn(); renderCover({ onChange });
    expect(validateCoverImageURL("nope")).toBeNull();
    expect(validateCoverImageURL("https://example.com/cover.jpg")).toBe("https://example.com/cover.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Change cover" }));
    fireEvent.click(document.querySelector('[aria-label="Use Mint cover"]')!);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ presetId: "mint" })));
  });
  it("supports keyboard removal", async () => {
    const onChange = vi.fn();
    renderCover({ value: { source: "gradient", presetId: "mint" }, onChange });
    fireEvent.click(screen.getByRole("button", { name: "Remove cover" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
  });
  it("resets uncontrolled cover state when the record scope changes", async () => {
    const onChange = vi.fn();
    const view = renderCover({ recordKey: "one", onChange });
    fireEvent.click(screen.getByRole("button", { name: "Change cover" }));
    fireEvent.click(document.querySelector('[aria-label="Use Mint cover"]')!);
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove cover" })).toBeInTheDocument());
    view.rerender(<TamaguiProvider config={tamaguiConfig} defaultTheme="light"><WireframeCover recordKey="two" onChange={onChange} /></TamaguiProvider>);
    expect(screen.queryByRole("button", { name: "Remove cover" })).not.toBeInTheDocument();
  });
  it("persists uploaded covers by FileMetadataID and loads bytes through the authenticated API", async () => {
    const onUpload = vi.fn().mockResolvedValue({ id: "FILE-COVER-1" });
    const onChange = vi.fn();
    vi.spyOn(api, "getFileContent").mockResolvedValue(new Blob(["image"], { type: "image/png" }));
    renderCover({ onUpload, onChange });
    fireEvent.click(screen.getByRole("button", { name: "Change cover" }));
    fireEvent.click(screen.getByText("Upload"));
    const file = new File(["image"], "cover.png", { type: "image/png" });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      source: "upload",
      fileMetadataID: "FILE-COVER-1",
      imageUrl: undefined,
    })));
    await waitFor(() => expect(api.getFileContent).toHaveBeenCalledWith("FILE-COVER-1", expect.any(AbortSignal)));
  });
  it("restores a saved image focal point when cover state hydrates", async () => {
    const view = renderCover({
      recordKey: "record-1",
      value: { source: "url", imageUrl: "https://example.com/cover.jpg", position: { x: 20, y: 30 } },
    });
    view.rerender(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <WireframeCover
          recordKey="record-1"
          value={{ source: "url", imageUrl: "https://example.com/cover.jpg", position: { x: 45, y: 65 } }}
        />
      </TamaguiProvider>,
    );
    await waitFor(() => expect(document.querySelector(".wireframe-cover-image")).toHaveStyle({ objectPosition: "45% 65%" }));
  });
});
