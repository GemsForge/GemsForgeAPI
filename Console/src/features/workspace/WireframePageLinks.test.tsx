import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "@gemsforge/ui";
import { WireframePageLinks } from "./WireframePageLinks";

type QueryState<T> = {
  data?: T;
  isPending: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
};

const query = <T,>(state: Partial<QueryState<T>>): QueryState<T> => ({
  isPending: false,
  isError: false,
  refetch: vi.fn(() => Promise.resolve()),
  ...state,
});

let domains = query<{ id: string; title: string; description: string }[]>({ data: [] });
let rootPages = query<{ id: number; parentID: null; domainID: string; title: string; description: string }[]>({
  data: [],
});

vi.mock("../../data/domainQueries", () => ({ useDomainsQuery: () => domains }));
vi.mock("../../data/workflowQueries", () => ({ usePagesQuery: () => rootPages }));

afterEach(() => {
  cleanup();
  domains = query({ data: [] });
  rootPages = query({ data: [] });
});

function renderLinks(path = "/", search = "") {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <MemoryRouter initialEntries={[path]}>
        <WireframePageLinks search={search} />
      </MemoryRouter>
    </TamaguiProvider>,
  );
}

describe("Wireframe page navigation", () => {
  it("lists domains and root pages with their ForgeKeeper destinations", () => {
    domains = query({ data: [{ id: "Life", title: "Life domain", description: "" }] });
    rootPages = query({ data: [{ id: 7, parentID: null, domainID: "Life", title: "Field notes", description: "" }] });
    renderLinks();

    const pages = screen.getByRole("navigation", { name: "Pages" });
    expect(screen.getByRole("link", { name: "Life domain" })).toHaveAttribute("href", "/forgekeeper/domain/Life");
    expect(screen.getByRole("link", { name: "Field notes" })).toHaveAttribute("href", "/forgekeeper/7/children");
    expect(pages).toContainElement(screen.getByRole("link", { name: "Field notes" }));
  });

  it("marks the page for the current route", () => {
    rootPages = query({ data: [{ id: 7, parentID: null, domainID: "Life", title: "Field notes", description: "" }] });
    renderLinks("/forgekeeper/7/children");

    expect(screen.getByRole("link", { name: "Field notes" })).toHaveAttribute("aria-current", "page");
  });

  it("filters pages with the navigation search", () => {
    domains = query({ data: [{ id: "Life", title: "Life domain", description: "" }] });
    rootPages = query({ data: [{ id: 7, parentID: null, domainID: "Life", title: "Field notes", description: "" }] });
    renderLinks("/", "field");

    expect(screen.getByRole("link", { name: "Field notes" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Life domain" })).not.toBeInTheDocument();
  });

  it("explains loading and empty states", () => {
    rootPages = query({ isPending: true });
    renderLinks();
    expect(screen.getByRole("status")).toHaveTextContent("Loading pages…");
    cleanup();

    rootPages = query({ data: [] });
    renderLinks();
    expect(screen.getByText("No pages yet")).toBeInTheDocument();
  });

  it("retries only the failed request", () => {
    rootPages = query({ isError: true });
    renderLinks();

    expect(screen.getByRole("alert")).toHaveTextContent("Pages could not be loaded.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(rootPages.refetch).toHaveBeenCalledOnce();
    expect(domains.refetch).not.toHaveBeenCalled();
  });
});
