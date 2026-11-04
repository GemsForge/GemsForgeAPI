import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import { DomainSidebar } from "./DomainSidebar";
afterEach(cleanup);

function renderSidebar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DomainSidebar domains={[]} onRefresh={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("compact navigation disclosure", () => {
  it("exposes its expanded state and closes after navigation", () => {
    vi.spyOn(api, "getSchemaPageTables").mockResolvedValue({ tables: [], availableTables: [] });
    renderSidebar();
    const toggle = screen.getByRole("button", { name: "Navigation" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "sidebar-links");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("link", { name: "Education" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("lists eligible schema pages as navigable records views", async () => {
    vi.spyOn(api, "getSchemaPageTables").mockResolvedValue({
      tables: [
        {
          name: "FamilyGoals",
          columns: [{ name: "ID", dataType: "TEXT", nullable: false, primaryKey: true, defaultValue: null }],
        },
      ],
      availableTables: [],
    });
    renderSidebar();

    const link = await screen.findByRole("link", { name: "FamilyGoals" });
    expect(link).toHaveAttribute("href", "/schema/FamilyGoals");
    expect(screen.getByText("1 properties")).toBeInTheDocument();
  });
});
