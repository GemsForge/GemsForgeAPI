import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "@gemsforge/ui";
import { WorkspaceView } from "./WorkspaceView";

const workflow = vi.hoisted(() => ({
  query: {
    data: [] as unknown[],
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
  mutateAsync: vi.fn(),
}));

vi.mock("../../data/workflowQueries", () => ({
  usePagesQuery: () => workflow.query,
  usePageMutation: () => ({ mutateAsync: workflow.mutateAsync, isPending: false, error: null }),
}));

const pages = [
  { id: 1, parentID: null, domainID: "life", title: "Field notes", description: "Observations and ideas." },
  { id: 2, parentID: null, domainID: "life", title: "Chromalock", description: "A project page." },
  { id: 3, parentID: null, domainID: "life", title: "Database handbook", description: "Reference notes." },
];

function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <MemoryRouter>
          <WorkspaceView onSuccess={vi.fn()} />
        </MemoryRouter>
      </TamaguiProvider>
    </QueryClientProvider>,
  );
}

describe("connected knowledge workspace", () => {
  beforeEach(() => {
    workflow.query = { data: pages, isLoading: false, error: null, refetch: vi.fn() };
    workflow.mutateAsync.mockReset();
  });

  it("shows the selected direct links in the mini-map and opens a linked page", async () => {
    renderWorkspace();

    const map = await screen.findByRole("navigation", { name: "Pages connected to Field notes" });
    expect(map.querySelector("[aria-current='page']")).toHaveTextContent("Field notes");
    expect(within(map).getByRole("button", { name: "Open Chromalock" })).toBeInTheDocument();
    expect(within(map).getByRole("button", { name: "Open Database handbook" })).toBeInTheDocument();

    fireEvent.click(within(map).getByRole("button", { name: "Open Chromalock" }));
    expect(await screen.findByRole("heading", { name: "Chromalock" })).toBeInTheDocument();
    expect(await screen.findByRole("navigation", { name: "Pages connected to Chromalock" })).toBeInTheDocument();
  });

  it("persists edited page title and description through the existing mutation", async () => {
    workflow.mutateAsync.mockResolvedValue(undefined);
    renderWorkspace();
    fireEvent.click(await screen.findByRole("button", { name: "Edit page details" }));
    fireEvent.change(screen.getByLabelText("Page title"), { target: { value: "Field journal" } });
    fireEvent.change(screen.getByLabelText("Page description"), { target: { value: "A revised description." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(workflow.mutateAsync).toHaveBeenCalledWith({
        id: pages[0].id,
        patch: { title: "Field journal", description: "A revised description." },
      }),
    );
  });

  it("updates the preview map when a local related-page selection changes", async () => {
    renderWorkspace();
    fireEvent.click(await screen.findByRole("button", { name: "Edit list" }));

    const checkbox = screen.getByRole("checkbox", { name: "Link Chromalock from Field notes" });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);

    const map = screen.getByRole("navigation", { name: "Pages connected to Field notes" });
    expect(within(map).queryByRole("button", { name: "Open Chromalock" })).not.toBeInTheDocument();
    expect(workflow.mutateAsync).not.toHaveBeenCalled();
  });

  it("shows an honest no-connections state for a page without selected links", async () => {
    workflow.query = { data: [pages[0]], isLoading: false, error: null, refetch: vi.fn() };
    renderWorkspace();

    expect(await screen.findByText(/No linked pages yet/)).toBeInTheDocument();
    expect(screen.getByText("Local sample · Markdown")).toBeInTheDocument();
    expect(screen.getByText("Sample table · local demo")).toBeInTheDocument();
  });

  it("keeps empty, loading, and failure feedback distinct", async () => {
    workflow.query = { data: [], isLoading: false, error: null, refetch: vi.fn() };
    const { rerender } = renderWorkspace();
    expect(await screen.findByText("Your library is ready for its first page")).toBeInTheDocument();

    workflow.query = { data: [], isLoading: true, error: null, refetch: vi.fn() };
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
          <MemoryRouter>
            <WorkspaceView onSuccess={vi.fn()} />
          </MemoryRouter>
        </TamaguiProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading records");

    workflow.query = { data: [], isLoading: false, error: new Error("offline"), refetch: vi.fn() };
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
          <MemoryRouter>
            <WorkspaceView onSuccess={vi.fn()} />
          </MemoryRouter>
        </TamaguiProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Your library is ready for its first page")).not.toBeInTheDocument();
  });
});
