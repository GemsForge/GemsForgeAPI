import { TamaguiProvider } from "tamagui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("opens a Tamagui list item on single click without selecting it", async () => {
    const onExpand = vi.fn();
    const twoRecords = [records[0], { id: "2", source: { name: "Beta", kind: "Service" }, title: "Beta" }];
    renderWithTheme(
      <Table.Root
        rows={twoRecords}
        columns={columns}
        rowKey={(record) => record.id}
        selection={{ matchingIds: ["1", "2"] }}
      >
        <Table.Selection />
        <RecordList properties={properties} onExpansionChange={onExpand} />
      </Table.Root>,
    );

    const alpha = screen.getByRole("listitem", { name: "Open Alpha" });
    const beta = screen.getByRole("listitem", { name: "Open Beta" });
    expect(alpha.closest("li")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View" })).not.toBeInTheDocument();
    fireEvent.click(alpha, { detail: 1 });
    expect(alpha).toHaveAttribute("data-selected", "false");
    await waitFor(() => expect(onExpand).toHaveBeenLastCalledWith("1"));
    fireEvent.click(beta, { detail: 1 });
    expect(alpha).toHaveAttribute("data-selected", "false");
    expect(beta).toHaveAttribute("data-selected", "false");
    expect(screen.getByRole("group", { name: "Selection controls" })).toHaveTextContent("0 selected");
    await waitFor(() => expect(onExpand).toHaveBeenLastCalledWith("2"));
  });

  it("toggles multiple selection on a double-click without opening the detail", async () => {
    const onExpand = vi.fn();
    const twoRecords = [records[0], { id: "2", source: { name: "Beta", kind: "Service" }, title: "Beta" }];
    renderWithTheme(
      <Table.Root
        rows={twoRecords}
        columns={columns}
        rowKey={(record) => record.id}
        selection={{ matchingIds: ["1", "2"] }}
      >
        <Table.Selection />
        <RecordList properties={properties} onExpansionChange={onExpand} />
      </Table.Root>,
    );

    const alpha = screen.getByRole("listitem", { name: "Open Alpha" });
    const beta = screen.getByRole("listitem", { name: "Open Beta" });
    fireEvent.click(alpha, { detail: 1 });
    fireEvent.click(alpha, { detail: 2 });
    fireEvent.doubleClick(alpha);
    fireEvent.click(beta, { detail: 2 });
    fireEvent.doubleClick(beta);
    expect(alpha).toHaveAttribute("data-selected", "true");
    expect(beta).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("group", { name: "Selection controls" })).toHaveTextContent("2 selected");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(onExpand).not.toHaveBeenCalled();

    fireEvent.keyDown(beta, { key: "Enter" });
    expect(screen.getByRole("group", { name: "Selection controls" })).toHaveTextContent("2 selected");
    expect(onExpand).toHaveBeenCalledWith("2");
    fireEvent.keyDown(alpha, { key: "Enter", shiftKey: true });
    expect(screen.getByRole("group", { name: "Selection controls" })).toHaveTextContent("1 selected");
  });

  it("opens the consumer detail from the whole gallery card without a View button", () => {
    const onExpand = vi.fn();
    renderWithTheme(
      <RecordGallery records={records} properties={properties} onExpansionChange={() => onExpand(records[0])} />,
    );
    screen.getByRole("button", { name: "Open Alpha" }).click();
    expect(onExpand).toHaveBeenCalledWith(records[0]);
    expect(screen.queryByRole("button", { name: "View" })).not.toBeInTheDocument();
    expect(screen.getByText("unconfigured")).toBeInTheDocument();
  });

  it("keeps the gallery image region blank when no valid image is configured", () => {
    renderWithTheme(
      <RecordGallery records={[{ ...records[0], image: { src: "", alt: "Missing logo" } }]} properties={properties} />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Alpha image preview")).toBeInTheDocument();
  });

  it("supports a labeled card size control and keyboard card activation", () => {
    const onExpand = vi.fn();
    renderWithTheme(
      <RecordGallery records={records} properties={properties} onExpansionChange={() => onExpand(records[0])} />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Card size" }), { target: { value: "large" } });
    const card = screen.getByRole("button", { name: "Open Alpha" });
    fireEvent.keyDown(card, { key: "Enter" });

    expect(card).toHaveAttribute("aria-label", "Open Alpha");
    expect(onExpand).toHaveBeenCalledWith(records[0]);
  });

  it("selects a contiguous card range by pointer drag without opening details", () => {
    const onExpand = vi.fn();
    const onSelectionChange = vi.fn();
    const galleryRecords = [records[0], { id: "2", source: { name: "Beta", kind: "Service" }, title: "Beta" }];
    const originalElementFromPoint = document.elementFromPoint;
    renderWithTheme(
      <Table.Root
        rows={galleryRecords}
        columns={columns}
        rowKey={(record) => record.id}
        selection={{ matchingIds: galleryRecords.map((record) => record.id), onSelectionChange }}
      >
        <RecordGallery records={galleryRecords} properties={properties} onExpansionChange={onExpand} />
      </Table.Root>,
    );

    const firstCard = screen.getByRole("button", { name: "Open Alpha" });
    const secondCard = screen.getByRole("button", { name: "Open Beta" });
    document.elementFromPoint = () => secondCard.closest("[data-gallery-record-id]") as HTMLElement;
    fireEvent.pointerDown(firstCard, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(firstCard, { pointerId: 1, clientX: 20, clientY: 0 });
    fireEvent.pointerUp(firstCard, { pointerId: 1, clientX: 20, clientY: 0 });
    fireEvent.click(firstCard);

    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["1", "2"]));
    expect(onExpand).not.toHaveBeenCalled();
    document.elementFromPoint = originalElementFromPoint;
  });

  it("renders ordered properties as table columns and supports selection", async () => {
    const onSelect = vi.fn();
    renderWithTheme(
      <RecordTable records={records} properties={properties} onRecordSelect={() => onSelect(records[0].source)} />,
    );
    expect(await screen.findByRole("columnheader", { name: "Kind" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Select Alpha" }));
    expect(onSelect).toHaveBeenCalledWith(records[0].source);
  });

  it("opens the consumer detail from the table row", async () => {
    const onExpand = vi.fn();
    renderWithTheme(<RecordTable records={records} properties={properties} onExpansionChange={onExpand} />);

    expect(screen.queryByRole("button", { name: "Expand Alpha" })).not.toBeInTheDocument();
    expect(onExpand).not.toHaveBeenCalled();
  });

  it.each([
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
    expect(await screen.findByRole("checkbox", { name: "Deselect Alpha" })).toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: "Deselect Alpha" }));
    expect(screen.getByRole("checkbox", { name: "Select Alpha" })).not.toBeChecked();
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
    expect(await screen.findByRole("checkbox", { name: "Select Alpha" })).toBeDisabled();
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
    fireEvent.click(screen.getByRole("button", { name: "List" }));

    expect(screen.getByRole("listitem", { name: "Open Alpha, selected" })).toHaveAttribute("data-selected", "true");
  });
});
