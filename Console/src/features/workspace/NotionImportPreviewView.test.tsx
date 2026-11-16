import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotionImportPreviewView, reviewReportRows } from "./NotionImportPreviewView";

vi.mock("../../data/notionImportQueries", () => ({
  useNotionImportPreviewQuery: () => ({
    data: {
      readOnly: true,
      confirmationToken: "token",
      expiresAt: "2026-01-01T00:00:00Z",
      totalRows: 4,
      warnings: [],
      unmappedProperties: ["Collections: database target", "Collections: formula"],
      resources: [
        {
          notionID: "notion-source-111111",
          title: "Collections",
          notionObject: "data_source",
          target: "New table: Collections",
          rowCount: 1,
          properties: [],
          unmappedProperties: ["database target", "formula"],
        },
        {
          notionID: "hidden-source",
          title: "Unavailable data source (hidden-source)",
          notionObject: "data_source",
          target: "Not imported: data source unavailable",
          rowCount: 3,
          properties: [],
          unmappedProperties: ["data source not shared with the Notion integration"],
        },
      ],
    },
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("NotionImportPreviewView", () => {
  it("counts unavailable sources separately while keeping them listed for review", () => {
    render(<NotionImportPreviewView />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "1 database, 0 pages, 1 unavailable data source, and 4 proposed items found.",
    );
    expect(screen.getByText("Collections (…111111): formula")).toBeInTheDocument();
    expect(screen.queryByText(/database target/)).not.toBeInTheDocument();
    expect(screen.getByText(/New table: Collections$/)).toBeInTheDocument();
    expect(screen.getByText("Collections (…111111)", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Unavailable data source (hidden-source)", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Review needed")).toBeInTheDocument();
  });

  it("includes unavailable data sources in the review report", () => {
    const rows = reviewReportRows({
      readOnly: true,
      expiresAt: "2026-01-01T00:00:00Z",
      totalRows: 0,
      warnings: [],
      unmappedProperties: [],
      resources: [
        {
          notionID: "hidden-source",
          title: "Unavailable data source (hidden-source)",
          notionObject: "data_source",
          target: "Not imported: data source unavailable",
          rowCount: 3,
          properties: [],
          unmappedProperties: ["3 row(s) will not be imported: data source not shared with the Notion integration"],
        },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain('"hidden-source"');
    expect(rows[1]).toContain('"3"');
    expect(rows[1]).toContain("Share the data source with the Notion integration");
  });
});
