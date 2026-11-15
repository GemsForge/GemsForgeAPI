import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { tamaguiConfig } from "@gemsforge/ui";
import {
  matchesCollectionFilter,
  resolveColumnPropertyMetadata,
  WireframeCollectionView,
  type WireframeCollectionConfig,
} from "./WireframeCollectionView";

vi.mock("../../data/workflowQueries", () => ({
  useLiveSchemaQuery: () => ({ data: { tables: [] } }),
  useUploadImageMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("../../data/trashQueries", () => ({
  useTrashEntriesQuery: () => ({ data: [] }),
  useArchiveRecordMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("../../data/presentationQueries", () => ({
  useTableViewsQuery: () => ({ isSuccess: true, data: { List: null, Gallery: null, Table: null } }),
  useSaveTableViewWorkspaceStateMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue(undefined) }),
  useRecordPresentationsQuery: () => ({ data: [] }),
  useSaveRecordPresentationMutation: () => ({ mutateAsync: vi.fn() }),
  useDeleteRecordPresentationMutation: () => ({ mutateAsync: vi.fn() }),
}));

describe("WireframeCollectionView multi-select filters", () => {
  it("uses API definitions first and keeps WorkspaceState metadata as a fallback", () => {
    const workspace = resolveColumnPropertyMetadata(
      { Tags: "Tags", Status: "Status" },
      { Tags: ["old"], Status: ["Open"] },
      [
        {
          id: "d1",
          tableName: "Things",
          columnName: "Tags",
          propertyType: "MultiSelect",
          options: [{ value: "Home", color: null }],
        },
      ],
    );
    expect(workspace.propertyTypes).toEqual({ Tags: "MultiSelect", Status: "Status" });
    expect(workspace.propertySelectOptions).toEqual({ Tags: ["Home"], Status: ["Open"] });
  });

  it("uses definition options and matches whole tags in a status filter", async () => {
    const firstRecord = { id: "r1", status: "🏡 Home;💳 Credit" };
    const secondRecord = { id: "r2", status: "🏡 Homework" };
    expect(matchesCollectionFilter(firstRecord, "🏡 Home", "status", true, (record) => record.status)).toBe(true);
    expect(matchesCollectionFilter(secondRecord, "🏡 Home", "status", true, (record) => record.status)).toBe(false);
    const config: WireframeCollectionConfig<{ id: string; status: string }> = {
      tableName: "Things",
      title: "Things",
      description: "Test records",
      activeCollection: "Things",
      records: [firstRecord, secondRecord],
      properties: [
        {
          id: "status",
          sourceField: "Status",
          label: "Status",
          getValue: (record) => ({ raw: record.status, display: record.status }),
        },
      ],
      searchValues: (record) => [record.status],
      cardTitle: (record) => record.id,
      cardSubtitle: () => "",
      cardStatus: (record) => record.status,
      cardMeta: () => "",
      inspector: () => null,
      columnDefinitions: [
        {
          id: "status-definition",
          tableName: "Things",
          columnName: "Status",
          propertyType: "MultiSelect",
          options: [
            { value: "🏡 Home", color: "mint" },
            { value: "💳 Credit", color: "gold" },
          ],
        },
      ],
    };
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
          <MemoryRouter>
            <WireframeCollectionView config={config} />
          </MemoryRouter>
        </TamaguiProvider>
      </QueryClientProvider>,
    );

    const filterButton = screen.getByRole("button", { name: "Filter records" });
    expect(filterButton).toBeInTheDocument();
    expect(config.columnDefinitions?.[0].options.map((option) => option.value)).toEqual(["🏡 Home", "💳 Credit"]);
    expect(
      config.records
        .filter((record) => matchesCollectionFilter(record, "🏡 Home", "status", true, config.cardStatus))
        .map((record) => record.id),
    ).toEqual(["r1"]);
  });
});
