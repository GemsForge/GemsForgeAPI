import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../../design-system";
import { validateCoverImageURL, WireframeCover } from "./WireframeCover";

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
});
