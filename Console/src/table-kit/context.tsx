import { createContext, useContext } from "react";
import type { TableContextValue } from "./types";

export const TableContext = createContext<TableContextValue<unknown> | null>(null);

export function useTableContext<Row>(): TableContextValue<Row> {
  const context = useContext(TableContext);
  if (!context) throw new Error("Table Kit components must be rendered inside Table.Root");
  return context as TableContextValue<Row>;
}
