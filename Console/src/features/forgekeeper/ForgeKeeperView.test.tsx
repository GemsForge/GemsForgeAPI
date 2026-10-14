import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForgeKeeperView } from "./ForgeKeeperView";
import type { ForgeKeeperPage } from "../../types";

const page = { id: 1, title: "Example page", description: "Notes", parentID: null } as ForgeKeeperPage;
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  for (const [name, original] of [["showModal", originalShow], ["close", originalClose]] as const) {
    if (original) Object.defineProperty(HTMLDialogElement.prototype, name, original);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});
function setup(onPatch = vi.fn().mockResolvedValue(undefined)) {
  render(<ForgeKeeperView domain={null} pages={[page]} onLoadRoots={vi.fn()} onLoadChildren={vi.fn()} onPatch={onPatch} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example page" }));
  return onPatch;
}
describe("accessible page editor", () => {
  it("provides a named modal, labeled fields, and Escape dismissal", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Edit metadata" });
    expect(screen.getByLabelText("Title")).toHaveValue("Example page");
    expect(screen.getByRole("button", { name: "Close page editor" })).toBeEnabled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("announces a save failure and keeps the edited form available", async () => {
    setup(vi.fn().mockRejectedValue(new Error("Save failed")));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
    expect(screen.getByRole("dialog", { name: "Edit metadata" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });
});
