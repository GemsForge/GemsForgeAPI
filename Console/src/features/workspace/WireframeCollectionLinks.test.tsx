import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TamaguiProvider } from "tamagui";
import { describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "@gemsforge/ui";
import { WireframeCollectionLinks } from "./WireframeCollectionLinks";

vi.mock("../../data/presentationQueries", () => ({ useTableNavigationPreferences: () => ({}) }));
vi.mock("../../data/workflowQueries", () => ({ useSchemaPageTablesQuery: () => ({ data: { tables: [] } }) }));

describe("Wireframe collection navigation", () => {
  it("links the sidebar New table entry to the new-table page", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <MemoryRouter>
          <WireframeCollectionLinks
            activeCollection="Education"
            recordCount={0}
            counts={{}}
            search=""
            recordsByCollection={{}}
          />
        </MemoryRouter>
      </TamaguiProvider>,
    );
    expect(screen.getByRole("link", { name: "Create a new table" })).toHaveAttribute("href", "/new-table");
  });
});
