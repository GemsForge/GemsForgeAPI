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
});
