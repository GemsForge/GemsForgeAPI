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
          notionID: "notion-source-222222",
          title: "Collections",
          notionObject: "data_source",
          target: "New table: Collections2",
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
  it("shows new table targets without treating the target alone as review required", () => {
    render(<NotionImportPreviewView />);

    expect(screen.getByText("Collections (…111111): formula")).toBeInTheDocument();
    expect(screen.queryByText(/database target/)).not.toBeInTheDocument();
    expect(screen.getByText(/New table: Collections$/)).toBeInTheDocument();
    expect(screen.getByText(/New table: Collections2$/)).toBeInTheDocument();
    expect(screen.getByText("Collections (…111111)", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Collections (…222222)", { selector: "strong" })).toBeInTheDocument();
  });
});
