import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../design-system/tamagui.config";
import { DatabaseRecordCollection } from "./DatabaseRecordCollection";
import { useRecordUtilities } from "../hooks/useRecordUtilities";
import type { RecordAdapter } from "../table-kit";

interface ExampleRecord {
  id: string;
  name: string;
  status: string;
}

const records: ExampleRecord[] = [
  { id: "one", name: "Alpha", status: "Active" },
  { id: "two", name: "Beta", status: "Paused" },
];

const adapter: RecordAdapter<ExampleRecord> = {
  toTableRecord: (record) => ({
    id: record.id,
    source: record,
    title: record.name,
    status: { label: record.status },
  }),
  getPropertyDefinitions: () => [
    { id: "name", label: "Name", primary: true, getValue: (record) => ({ display: record.name }) },
    { id: "status", label: "Status", getValue: (record) => ({ display: record.status }) },
  ],
};

function Harness() {
  const utilities = useRecordUtilities(records, (record) => [record.id, record.name, record.status], {});
  return (
    <DatabaseRecordCollection
      label="Examples"
      records={records}
      utilities={utilities}
      adapter={adapter}
      sortOptions={[]}
      detailId={null}
      onDetailChange={() => undefined}
    />
  );
}

function ActionHarness() {
  const utilities = useRecordUtilities(records, (record) => [record.id, record.name, record.status], {});
  return (
    <DatabaseRecordCollection
      label="Examples"
      records={records}
      utilities={utilities}
      adapter={adapter}
      sortOptions={[]}
      detailId={null}
      onDetailChange={() => undefined}
      actions={{
        onNew: () => undefined,
        newRecordOptions: [{ id: "address", label: "New address", onSelect: () => undefined }],
      }}
    />
  );
}

describe("DatabaseRecordCollection", () => {
  it("uses the effective filtered result set for the shared Table.Root and detail action", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <Harness />
      </TamaguiProvider>,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search examples" }), { target: { value: "Beta" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Beta");
  });

  it("exposes scoped select-all and built-in view switching to the migrated consumer", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <Harness />
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(screen.getByRole("checkbox", { name: "Select all" })).toBeChecked();
    fireEvent.click(screen.getByRole("tab", { name: "Table" }));
    expect(screen.getByRole("tab", { name: "Table" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the property menu in the compact utility toolbar", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <Harness />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("group", { name: "Property configuration" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Properties" }));
    expect(screen.getByRole("dialog", { name: "Properties" })).toBeInTheDocument();
  });

  it("keeps secondary query controls behind the compact More utilities action", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <Harness />
      </TamaguiProvider>,
    );

    expect(screen.queryByRole("dialog", { name: "Examples query utilities" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More utilities" }));
    expect(screen.getByRole("dialog", { name: "Examples query utilities" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Examples query utilities" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Examples query utilities" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More utilities" })).toHaveFocus();
  });

  it("passes consumer-owned New Record actions through the collection shell", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <ActionHarness />
      </TamaguiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New record options" }));
    expect(screen.getByRole("menuitem", { name: "New address" })).toBeInTheDocument();
  });
});
