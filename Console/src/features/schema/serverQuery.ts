import type { SchemaPageQueryNode, SchemaPageQueryRequest } from "../../types";

export interface ServerQueryControls {
  search: string;
  filter: string;
  filterColumn?: string;
  sortColumn?: string;
  direction: "asc" | "desc";
  groupBy: string;
  limit: number;
  offset: number;
}

export function buildSchemaPageQuery(controls: ServerQueryControls): SchemaPageQueryRequest {
  const nodes: SchemaPageQueryNode[] = [
    {
      id: "console-root",
      parentQueryID: null,
      nodeType: "Group",
      columnName: null,
      comparisonOperator: null,
      valueType: null,
      value: null,
      booleanOperator: "AND",
      direction: null,
      sortOrder: 0,
    },
  ];
  if (controls.filter && controls.filterColumn) {
    nodes.push({
      id: "console-filter",
      parentQueryID: "console-root",
      nodeType: "Condition",
      columnName: controls.filterColumn,
      comparisonOperator: "Equals",
      valueType: "Text",
      value: controls.filter,
      booleanOperator: null,
      direction: null,
      sortOrder: 0,
    });
  }
  if (controls.sortColumn) {
    nodes.push({
      id: "console-sort",
      parentQueryID: null,
      nodeType: "Sort",
      columnName: controls.sortColumn,
      comparisonOperator: null,
      valueType: null,
      value: null,
      booleanOperator: null,
      direction: controls.direction === "asc" ? "Ascending" : "Descending",
      sortOrder: 0,
    });
  }
  if (controls.groupBy) {
    nodes.push({
      id: "console-group",
      parentQueryID: null,
      nodeType: "RecordGroup",
      columnName: controls.groupBy,
      comparisonOperator: null,
      valueType: null,
      value: null,
      booleanOperator: null,
      direction: null,
      sortOrder: 1,
    });
  }
  return { nodes, search: controls.search, limit: controls.limit, offset: controls.offset };
}
