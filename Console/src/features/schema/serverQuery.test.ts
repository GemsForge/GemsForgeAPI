import { describe, expect, it } from "vitest";
import { buildSchemaPageQuery } from "./serverQuery";

describe("buildSchemaPageQuery", () => {
  it("maps collection controls to validated nodes and page values", () => {
    const query = buildSchemaPageQuery({
      search: " travel ",
      filter: "Active",
      filterColumn: "Status",
      sortColumn: "Title",
      direction: "desc",
      groupBy: "Category",
      limit: 18,
      offset: 36,
    });
    expect(query.search).toBe(" travel ");
    expect(query.limit).toBe(18);
    expect(query.offset).toBe(36);
    expect(query.nodes?.map((node) => node.nodeType)).toEqual(["Group", "Condition", "Sort", "RecordGroup"]);
    expect(query.nodes?.[1]).toMatchObject({ columnName: "Status", comparisonOperator: "Equals", value: "Active" });
    expect(query.nodes?.[2]).toMatchObject({ columnName: "Title", direction: "Descending" });
  });
});
