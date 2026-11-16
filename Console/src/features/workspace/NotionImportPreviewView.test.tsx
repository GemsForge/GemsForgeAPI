import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotionImportPreviewView } from "./NotionImportPreviewView";

vi.mock("../../data/notionImportQueries", () => ({
  useNotionImportPreviewQuery: () => ({
    data: {
      readOnly: true,
      confirmationToken: "token",
      expiresAt: "2026-01-01T00:00:00Z",
      totalRows: 2,
      warnings: [],
      unmappedProperties: ["Collections: database target", "Collections: database target"],
      resources: [
        {
          notionID: "notion-source-111111",
          title: "Collections",
          notionObject: "data_source",
          target: "Review required",
          rowCount: 1,
          properties: [],
          unmappedProperties: ["database target"],
        },
        {
          notionID: "notion-source-222222",
          title: "Collections",
          notionObject: "data_source",
          target: "Review required",
          rowCount: 1,
          properties: [],
          unmappedProperties: ["database target"],
        },
      ],
    },
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("NotionImportPreviewView", () => {
  it("disambiguates same-named resources in review items and headings", () => {
    render(<NotionImportPreviewView />);

    expect(screen.getByText("Collections (…111111): database target")).toBeInTheDocument();
    expect(screen.getByText("Collections (…222222): database target")).toBeInTheDocument();
    expect(screen.getByText("Collections (…111111)", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Collections (…222222)", { selector: "strong" })).toBeInTheDocument();
  });
});
