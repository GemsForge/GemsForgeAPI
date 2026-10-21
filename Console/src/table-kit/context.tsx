import { createContext, useContext } from "react";
import type { TableContextValue } from "./types";

export const TableContext = createContext<TableContextValue<unknown> | null>(null);

/** Read the nearest Table.Root context and fail fast when used outside a root. */
export function useTableContext<Row>(): TableContextValue<Row> {
  const context = useContext(TableContext);
  if (!context) throw new Error("Table Kit components must be rendered inside Table.Root");
  return context as TableContextValue<Row>;
}
