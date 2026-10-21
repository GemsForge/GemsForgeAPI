import { TamaguiProvider } from "tamagui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { RecordGallery, RecordList, RecordTable, type RecordPropertyDefinition, type TableRecord } from "./index";
import { tamaguiConfig } from "../design-system/tamagui.config";

interface Service {
  name: string;
  kind: string;
}
const records: TableRecord<Service>[] = [
  {
    id: "1",
    source: { name: "Alpha", kind: "Service" },
    title: "Alpha",
    image: { src: "alpha.png", alt: "Alpha logo" },
  },
];
const properties: RecordPropertyDefinition<Service>[] = [
  { id: "kind", label: "Kind", order: 1, getValue: (record) => ({ display: record.kind }) },
  { id: "empty", label: "Empty", order: 2, getValue: () => ({ display: "" }) },
];
const renderWithTheme = (children: ReactNode) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      {children}
    </TamaguiProvider>,
  );

describe("Table Kit record renderers", () => {
  it("renders a list from generic record/property contracts", () => {
    renderWithTheme(<RecordList records={records} properties={properties} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("Alpha");
    expect(screen.getByText("Service")).toBeInTheDocument();
  });

  it("renders a gallery with stable media and expansion callbacks", () => {
    const onExpand = vi.fn();
    renderWithTheme(
      <RecordGallery records={records} properties={properties} onExpansionChange={() => onExpand(records[0])} />,
    );
    screen.getByRole("button", { name: "View" }).click();
    expect(onExpand).toHaveBeenCalledWith(records[0]);
    expect(screen.getByText("unconfigured")).toBeInTheDocument();
  });

  it("renders ordered properties as table columns and supports selection", () => {
    const onSelect = vi.fn();
    renderWithTheme(
      <RecordTable records={records} properties={properties} onRecordSelect={() => onSelect(records[0].source)} />,
    );
    expect(screen.getByRole("columnheader", { name: "Kind" })).toBeInTheDocument();
    screen.getByRole("button", { name: "Select Alpha" }).click();
    expect(onSelect).toHaveBeenCalledWith(records[0].source);
  });
});
