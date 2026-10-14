import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainSidebar } from "./DomainSidebar";
afterEach(cleanup);
describe("compact navigation disclosure", () => {
  it("exposes its expanded state and closes after navigation", () => {
    render(<MemoryRouter><DomainSidebar domains={[]} onRefresh={vi.fn()} /></MemoryRouter>);
    const toggle = screen.getByRole("button", { name: "Navigation" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "sidebar-links");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("link", { name: "Education" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
