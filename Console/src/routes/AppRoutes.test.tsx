import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { TamaguiProvider } from "tamagui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./AppRoutes";
import { api } from "../api";
import { tamaguiConfig } from "../design-system";
import { AuthProvider } from "../auth/AuthProvider";
import { clearSession, saveSession } from "../auth/session";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  clearSession();
});
function HistoryControls() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate(-1)}>Go back</button>
      <button onClick={() => navigate(1)}>Go forward</button>
    </>
  );
}
function setup(path = "/", authenticated = true) {
  vi.spyOn(api, "listDomains").mockResolvedValue([
    { id: "Life", title: "Life domain", description: "Personal records" },
  ]);
  vi.spyOn(api, "getHealth").mockResolvedValue(true);
  if (authenticated) saveSession({ token: "test-session", expiresAt: "2099-01-01T00:00:00Z" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  render(
    <QueryClientProvider client={client}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <HistoryControls />
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </TamaguiProvider>
    </QueryClientProvider>,
  );
  return client;
}

describe("Gem Life navigation", () => {
  it("redirects unauthenticated protected routes before loading record data", async () => {
    const domains = vi.spyOn(api, "listDomains");
    setup("/addresses", false);
    expect(await screen.findByRole("heading", { name: "Sign in to Gem Life" })).toBeInTheDocument();
    expect(domains).not.toHaveBeenCalled();
  });

  it("supports the packaged /app base without changing API endpoints", async () => {
    vi.spyOn(api, "listDomains").mockResolvedValue([]);
    vi.spyOn(api, "listEducation").mockResolvedValue([]);
    vi.spyOn(api, "getHealth").mockResolvedValue(true);
    saveSession({ token: "test-session", expiresAt: "2099-01-01T00:00:00Z" });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
          <AuthProvider>
            <MemoryRouter basename="/app" initialEntries={["/app/education"]}>
              <AppRoutes />
            </MemoryRouter>
          </AuthProvider>
        </TamaguiProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Education" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/app");
  });
  it("renders home without requesting feature data", async () => {
    const education = vi.spyOn(api, "listEducation");
    setup();
    expect(screen.getByRole("heading", { name: "Welcome to Gem Life" })).toBeInTheDocument();
    expect(education).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  });
  it("loads a domain from a direct URL and renders its pages", async () => {
    const pages = vi.spyOn(api, "listPagesForDomain").mockResolvedValue([]);
    setup("/domains/Life");
    expect(await screen.findByRole("heading", { name: "Life domain" })).toBeInTheDocument();
    expect(pages).toHaveBeenCalledWith("Life", expect.any(AbortSignal));
  });
  it("keeps Back and Forward synchronized with the route", async () => {
    vi.spyOn(api, "listEducation").mockResolvedValue([]);
    vi.spyOn(api, "listEmployment").mockResolvedValue([]);
    setup("/education");
    await screen.findByRole("heading", { name: "Education" });
    fireEvent.click(screen.getByRole("link", { name: "Employment" }));
    await screen.findByRole("heading", { name: "Employment" });
    expect(screen.getByRole("region", { name: "Current screen" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    await screen.findByRole("heading", { name: "Education" });
    fireEvent.click(screen.getByRole("button", { name: "Go forward" }));
    await screen.findByRole("heading", { name: "Employment" });
  });
  it.each(["/education-typo", "/addresses/unknown", "/domains/missing", "/forgekeeper/not-a-number/children"])(
    "shows not found for %s",
    async (path) => {
      setup(path);
      expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    },
  );
  it("shows pending, failure, and successful retry states", async () => {
    let reject!: (error: Error) => void;
    const request = vi
      .spyOn(api, "listEducation")
      .mockReturnValueOnce(
        new Promise((_, failure) => {
          reject = failure;
        }),
      )
      .mockResolvedValue([]);
    setup("/education");
    expect(screen.getByText("Loading records…")).toBeInTheDocument();
    await act(async () => reject(new Error("API unavailable")));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/something went wrong|api unavailable/i);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "No education records" });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });
  it("resolves expense aliases without keeping duplicate routes in history", async () => {
    vi.spyOn(api, "listTransactions").mockResolvedValue([]);
    setup("/expenses");
    expect(await screen.findByRole("heading", { name: "Expense Tracker" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Expense Tracker" })).toHaveAttribute("aria-current", "page");
  });
  it("renders the live database migration screen from a direct URL", async () => {
    vi.spyOn(api, "getLiveSchema").mockResolvedValue({ databaseName: "GemLife", tableCount: 1, tables: [] });
    setup("/live-database");
    expect(await screen.findByRole("heading", { name: "Repository migrations" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Live Database" })).toHaveAttribute("aria-current", "page");
  });
});
