import { TamaguiProvider } from "tamagui";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import {
  RecordGallery,
  RecordList,
  RecordTable,
  Table,
  useTableContext,
  type RecordPropertyDefinition,
  type TableRecord,
} from "./index";
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
const columns = [{ id: "name", header: "Name", cell: (record: TableRecord<Service>) => record.title }];
const renderWithTheme = (children: ReactNode) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      {children}
    </TamaguiProvider>,
  );

/** Give AG Grid a deterministic viewport because jsdom does not calculate layout geometry. */
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
const geometryProperties = ["clientHeight", "clientWidth", "offsetHeight", "offsetWidth"] as const;
const originalGeometry = Object.fromEntries(
  geometryProperties.map((property) => [property, Object.getOwnPropertyDescriptor(HTMLElement.prototype, property)]),
);
beforeAll(() => {
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({
      bottom: 480,
      height: 480,
      left: 0,
      right: 1024,
      top: 0,
      width: 1024,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  Object.defineProperties(HTMLElement.prototype, {
    clientHeight: { configurable: true, get: () => 480 },
    clientWidth: { configurable: true, get: () => 1024 },
    offsetHeight: { configurable: true, get: () => 480 },
    offsetWidth: { configurable: true, get: () => 1024 },
  });
});
afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  for (const property of geometryProperties) {
    const descriptor = originalGeometry[property];
    if (descriptor) Object.defineProperty(HTMLElement.prototype, property, descriptor);
    else delete (HTMLElement.prototype as Partial<Record<(typeof geometryProperties)[number], unknown>>)[property];
  }
});

function ViewRenderer() {
  const { viewId } = useTableContext<TableRecord<Service>>();
  if (viewId === "list") return <RecordList records={records} properties={properties} />;
  return <RecordTable records={records} properties={properties} />;
}

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

  it("renders ordered properties as table columns and supports selection", async () => {
    const onSelect = vi.fn();
    renderWithTheme(
      <RecordTable records={records} properties={properties} onRecordSelect={() => onSelect(records[0].source)} />,
    );
    expect(await screen.findByRole("columnheader", { name: "Kind" })).toBeInTheDocument();
    (await screen.findByRole("button", { name: "Select Alpha" })).click();
    expect(onSelect).toHaveBeenCalledWith(records[0].source);
  });

  it("keeps expansion actions connected to the table renderer", async () => {
    const onExpand = vi.fn();
    renderWithTheme(<RecordTable records={records} properties={properties} onExpansionChange={onExpand} />);

    fireEvent.click(await screen.findByRole("button", { name: "Expand Alpha" }));
    expect(onExpand).toHaveBeenCalledWith(records[0].id);
  });

  it.each([
    ["list", RecordList],
    ["gallery", RecordGallery],
    ["table", RecordTable],
  ] as const)("shares scoped Root selection with the %s renderer", async (_view, Renderer) => {
    renderWithTheme(
      <Table.Root
        rows={records}
        columns={columns}
        rowKey={(record) => record.id}
        selection={{ matchingIds: [records[0].id] }}
      >
        <Table.Selection />
        <Renderer records={records} properties={properties} />
      </Table.Root>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(await screen.findByRole("button", { name: "Deselect Alpha" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Deselect Alpha" }));
    expect(screen.getByRole("button", { name: "Select Alpha" })).toHaveAttribute("aria-pressed", "false");
  });

  it("disables renderer selection for records excluded by the scoped policy", async () => {
    renderWithTheme(
      <Table.Root
        rows={records}
        columns={columns}
        rowKey={(record) => record.id}
        selection={{ matchingIds: [], isSelectable: () => false }}
      >
        <Table.Selection />
        <RecordTable records={records} properties={properties} />
      </Table.Root>,
    );

    expect(screen.getByRole("checkbox", { name: "Select all" })).toBeDisabled();
    expect(await screen.findByRole("button", { name: "Select Alpha" })).toBeDisabled();
  });

  it("preserves selection when switching between built-in view slots", () => {
    renderWithTheme(
      <Table.Root
        rows={records}
        columns={columns}
        rowKey={(record) => record.id}
        views={[
          { id: "table", label: "Table" },
          { id: "list", label: "List" },
        ]}
        defaultViewId="table"
        selection={{ matchingIds: [records[0].id] }}
      >
        <Table.Views />
        <Table.Selection />
        <ViewRenderer />
      </Table.Root>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    fireEvent.click(screen.getByRole("tab", { name: "List" }));

    expect(screen.getByRole("button", { name: "Deselect Alpha" })).toHaveAttribute("aria-pressed", "true");
  });
});
