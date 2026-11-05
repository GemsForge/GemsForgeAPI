import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { TamaguiProvider } from "tamagui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRoutes, ScreenBoundary } from "./AppRoutes";
import { api } from "../api";
import { tamaguiConfig } from "@gemsforge/ui";
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
function BrokenScreen(): never {
  throw new Error("employment render failed");
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
  it("exposes a captured screen render error during development", () => {
    render(
      <MemoryRouter>
        <ScreenBoundary>
          <BrokenScreen />
        </ScreenBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("employment render failed");
  });
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
  it("renders wireframe routes on their dedicated canvas", async () => {
    vi.spyOn(api, "listEducation").mockResolvedValue([]);
    vi.spyOn(api, "getSchemaPageTables").mockResolvedValue({ tables: [], availableTables: [] });
    setup("/education-wireframe");
    expect(await screen.findByRole("heading", { name: "Education" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Wireframe screen" })).toHaveClass("wireframe-canvas-content");
    expect(screen.getByRole("navigation", { name: "Workspace navigation" })).toHaveClass("wireframe-demo-sidebar");
    expect(screen.getByRole("link", { name: /Gem Hues/ })).toHaveAttribute("href", "/gemhues-wireframe");
    expect(screen.getByRole("link", { name: /Employment/ })).toHaveAttribute("href", "/employment-wireframe");
    expect(screen.getByRole("link", { name: /Expense Tracker/ })).toHaveAttribute("href", "/transactions-wireframe");
    // The inspector is record-scoped and stays closed when the collection is empty.
    expect(screen.queryByRole("complementary", { name: "Record inspector" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Gem Life Console" })).not.toBeInTheDocument();
  });
  it("lists live schema pages in the wireframe navigation and opens them on the wireframe canvas", async () => {
    vi.spyOn(api, "listEducation").mockResolvedValue([]);
    const columns = [
      { name: "CategoryID", dataType: "INTEGER", nullable: false, primaryKey: true, defaultValue: null },
      { name: "HubID", dataType: "TEXT", nullable: true, primaryKey: false, defaultValue: null },
      { name: "Category", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
    ];
    vi.spyOn(api, "getSchemaPageTables").mockResolvedValue({
      tables: [
        { name: "BudgetCategories", columns },
        { name: "Education", columns },
      ],
      availableTables: [],
    });
    vi.spyOn(api, "getSchemaPageRecords").mockResolvedValue({
      table: { name: "BudgetCategories", columns },
      rows: [{ CategoryID: "12", HubID: "workspace-a", Category: "Housing" }],
      totalCount: 1,
      limit: 100,
      offset: 0,
    });
    vi.spyOn(api, "getTableView").mockImplementation(async (_table, viewType) => ({
      view: {
        viewID: viewType,
        tableName: "BudgetCategories",
        name: viewType,
        viewType,
        workspaceState: JSON.stringify({ tableIcon: "Folder" }),
        updatedAt: "2026-11-05T10:00:00Z",
      },
      columns: [],
      queries: [],
    }));
    setup("/education-wireframe");

    await screen.findByRole("navigation", { name: "Collections" });
    const budgetCategoriesLink = await screen.findByRole("link", { name: "BudgetCategories" });
    expect(budgetCategoriesLink).toHaveAttribute("href", "/schema-wireframe/BudgetCategories");
    expect(screen.getAllByRole("link", { name: "Education" })).toHaveLength(1);

    fireEvent.click(budgetCategoriesLink);
    expect(await screen.findByRole("heading", { name: "BudgetCategories" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Wireframe screen" })).toBeInTheDocument();
    expect(screen.getAllByText("Housing").length).toBeGreaterThan(0);
  });
  it("renders the wireframe home from live collection counts", async () => {
    vi.spyOn(api, "listRootPages").mockResolvedValue([]);
    vi.spyOn(api, "listEducation").mockResolvedValue([]);
    vi.spyOn(api, "listEmployment").mockResolvedValue([]);
    vi.spyOn(api, "listAddresses").mockResolvedValue([]);
    vi.spyOn(api, "listTransactions").mockResolvedValue([]);
    vi.spyOn(api, "listGemHues").mockResolvedValue([]);
    vi.spyOn(api, "listServiceAccounts").mockResolvedValue([]);
    setup("/home-wireframe");

    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Education/ })
        .some((link) => link.getAttribute("href") === "/education-wireframe"),
    ).toBe(true);
    expect(screen.getByRole("link", { name: /Local Databases/ })).toHaveAttribute("href", "/local-databases-wireframe");
  });
  it("renders the wireframe domain catalog with ForgeKeeper destinations", async () => {
    setup("/domains-wireframe");

    expect(await screen.findByRole("heading", { name: "Domains" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Open ForgeKeeper pages in Life domain" })).toHaveAttribute(
      "href",
      "/forgekeeper-wireframe/domain/Life",
    );
  });
  it("renders root ForgeKeeper pages inside the wireframe workspace", async () => {
    vi.spyOn(api, "listRootPages").mockResolvedValue([
      { id: 7, parentID: null, domainID: "Life", title: "Family plan", description: "Shared priorities" },
    ]);
    setup("/forgekeeper-wireframe");

    expect(await screen.findByRole("heading", { name: "ForgeKeeper" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Family plan" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Life domain" })).toHaveAttribute(
      "href",
      "/forgekeeper-wireframe/domain/Life",
    );
  });
  it("renders the wireframe list of safe local databases", async () => {
    vi.spyOn(api, "getLocalDatabases").mockResolvedValue([{ databaseName: "GemLife_Dev.sqlite", fileSizeBytes: 2048 }]);
    vi.spyOn(api, "listEducation").mockResolvedValue([]);
    vi.spyOn(api, "listEmployment").mockResolvedValue([]);
    vi.spyOn(api, "listAddresses").mockResolvedValue([]);
    vi.spyOn(api, "listTransactions").mockResolvedValue([]);
    vi.spyOn(api, "listGemHues").mockResolvedValue([]);
    vi.spyOn(api, "listServiceAccounts").mockResolvedValue([]);
    setup("/local-databases-wireframe");

    expect(await screen.findByRole("heading", { name: "Local Databases" })).toBeInTheDocument();
    expect(await screen.findByText("GemLife_Dev.sqlite")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create database" })).toHaveAttribute("href", "/local-database-wireframe");
  });
  it("renders archived records and restores them from the Trash wireframe", async () => {
    const archived = {
      entryID: "trash-entry-1",
      tableName: "Education",
      recordID: "EDU-001",
      title: "Northview School",
      snapshot: '{"id":"EDU-001","schoolName":"Northview"}',
      trashedAt: "2026-11-04T12:00:00Z",
    };
    vi.spyOn(api, "listTrash").mockResolvedValue([archived]);
    const restore = vi.spyOn(api, "restoreTrashEntry").mockResolvedValue(undefined);
    vi.spyOn(api, "listEducation").mockResolvedValue([]);
    vi.spyOn(api, "listEmployment").mockResolvedValue([]);
    vi.spyOn(api, "listAddresses").mockResolvedValue([]);
    vi.spyOn(api, "listTransactions").mockResolvedValue([]);
    vi.spyOn(api, "listGemHues").mockResolvedValue([]);
    vi.spyOn(api, "listServiceAccounts").mockResolvedValue([]);
    setup("/trash-wireframe");

    expect(await screen.findByRole("heading", { name: "Trash" })).toBeInTheDocument();
    expect(await screen.findByText("1 record")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Northview School" })).toBeInTheDocument();
    expect(screen.getByText("Education · EDU-001")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Record details"));
    expect(screen.getByText(archived.snapshot)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => expect(restore).toHaveBeenCalledWith("trash-entry-1"));
    expect(screen.getByRole("heading", { name: "Northview School" })).toBeInTheDocument();
  });
  it("confirms permanent deletion and refreshes the Trash list", async () => {
    const archived = {
      entryID: "trash-entry-2",
      tableName: "Addresses",
      recordID: "ADDR-001",
      title: "Harbor home",
      snapshot: '{"id":"ADDR-001","city":"Boston"}',
      trashedAt: null,
    };
    vi.spyOn(api, "listTrash").mockResolvedValueOnce([archived]).mockResolvedValue([]);
    const permanentlyDelete = vi.spyOn(api, "permanentlyDeleteTrashEntry").mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(api, "listEducation").mockResolvedValue([]);
    vi.spyOn(api, "listEmployment").mockResolvedValue([]);
    vi.spyOn(api, "listAddresses").mockResolvedValue([]);
    vi.spyOn(api, "listTransactions").mockResolvedValue([]);
    vi.spyOn(api, "listGemHues").mockResolvedValue([]);
    vi.spyOn(api, "listServiceAccounts").mockResolvedValue([]);
    setup("/trash-wireframe");

    fireEvent.click(await screen.findByRole("button", { name: "Delete permanently" }));

    await waitFor(() => expect(permanentlyDelete).toHaveBeenCalledWith("trash-entry-2"));
    expect(confirm).toHaveBeenCalledWith("Permanently delete “Harbor home”? This cannot be undone.");
    expect(await screen.findByText("Trash is empty")).toBeInTheDocument();
  });
  it("routes application settings tools to their dedicated wireframe pages", async () => {
    setup("/application-settings-wireframe");

    expect(await screen.findByRole("heading", { name: "Application Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create database/ })).toHaveAttribute("href", "/local-database-wireframe");
    expect(screen.getByRole("link", { name: /Schema Builder/ })).toHaveAttribute("href", "/schema-builder-wireframe");
    expect(screen.getByRole("link", { name: /Live Database/ })).toHaveAttribute("href", "/live-database-wireframe");
  });
  it("renders the local database creation form in the wireframe shell", async () => {
    vi.spyOn(api, "getLocalDatabaseCapabilities").mockResolvedValue({
      enabled: true,
      ready: true,
      profiles: [{ id: "gem-life-development", name: "Development", migrations: ["CreateAddresses"] }],
      safetyRules: ["Create a new file only."],
    });
    setup("/local-database-wireframe");

    expect(await screen.findByRole("heading", { name: "Create local database" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Wireframe screen" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "New SQLite database" })).toBeInTheDocument();
  });
  it("renders the Schema Builder in the wireframe shell", async () => {
    setup("/schema-builder-wireframe");

    expect(await screen.findByRole("heading", { name: "Schema Builder" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Wireframe screen" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "New SQLite table" })).toBeInTheDocument();
  });
  it("renders Live Database migration tools in the wireframe shell", async () => {
    setup("/live-database-wireframe");

    expect(await screen.findByRole("heading", { name: "Live Database" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Wireframe screen" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Apply the repository schema" })).toBeInTheDocument();
  });
  it("closes mobile workspace navigation from the pane footer using header state", async () => {
    vi.spyOn(api, "listEducation").mockResolvedValue([]);
    setup("/education-wireframe");

    await screen.findByRole("heading", { name: "Education" });
    const headerToggle = await screen.findByRole("button", { name: "Open navigation" });
    fireEvent.click(headerToggle);
    expect(headerToggle).toHaveAttribute("aria-expanded", "true");

    const mobileClose = document.querySelector<HTMLButtonElement>(".demo-sidebar-toggle-mobile");
    expect(mobileClose).not.toBeNull();
    expect(mobileClose).toHaveAccessibleName("Close navigation");
    fireEvent.click(mobileClose!);

    expect(headerToggle).toHaveAttribute("aria-expanded", "false");
  });
  it("closes the mobile drawer and restores desktop pane focus when the viewport widens", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 900 });
    try {
      vi.spyOn(api, "listEducation").mockResolvedValue([]);
      setup("/education-wireframe");

      await screen.findByRole("heading", { name: "Education" });
      const headerToggle = await screen.findByRole("button", { name: "Open navigation" });
      fireEvent.click(headerToggle);
      expect(headerToggle).toHaveAttribute("aria-expanded", "true");

      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
      act(() => window.dispatchEvent(new Event("resize")));

      await waitFor(() => expect(headerToggle).toHaveAttribute("aria-expanded", "false"));
      const desktopToggle = document.querySelector<HTMLButtonElement>(".demo-sidebar-toggle-desktop");
      await waitFor(() => expect(desktopToggle).toHaveFocus());
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    }
  });
  it("renders home without requesting feature data", async () => {
    const education = vi.spyOn(api, "listEducation");
    setup();
    expect(await screen.findByRole("heading", { name: "Your data, connected" })).toBeInTheDocument();
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
    expect(await screen.findByText(/something went wrong|api unavailable/i)).toBeInTheDocument();
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
