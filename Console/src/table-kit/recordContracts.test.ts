import { describe, expect, it } from "vitest";
import { getPrimaryRecordProperty, orderRecordProperties, type RecordAdapter } from "./recordContracts";

interface ExampleRecord {
  id: string;
  name: string;
  status: string;
}

const adapter: RecordAdapter<ExampleRecord> = {
  toTableRecord: (record) => ({
    id: record.id,
    source: record,
    title: record.name,
    status: { label: record.status, tone: "default" },
  }),
  getPropertyDefinitions: () => [
    { id: "status", label: "Status", order: 2, getValue: (record) => ({ display: record.status }) },
    { id: "name", label: "Name", order: 1, primary: true, getValue: (record) => ({ display: record.name }) },
  ],
};

describe("Table Kit record contracts", () => {
  it("preserves adapter-owned record identity and presentation metadata", () => {
    const record = { id: "record-1", name: "Alpha", status: "Active" } satisfies ExampleRecord;

    expect(adapter.toTableRecord(record, 0)).toEqual({
      id: "record-1",
      source: record,
      title: "Alpha",
      status: { label: "Active", tone: "default" },
    });
  });

  it("shares one stable property definition set while resolving values per record", () => {
    const properties = adapter.getPropertyDefinitions();
    const secondRecord = { id: "record-2", name: "Beta", status: "Paused" } satisfies ExampleRecord;

    expect(orderRecordProperties(properties).map((property) => property.id)).toEqual(["name", "status"]);
    expect(properties.map((property) => property.id)).toEqual(["status", "name"]);
    expect(properties[0].getValue(secondRecord).display).toBe("Paused");
  });

  it("uses the explicit primary property before the first ordered property", () => {
    const properties = adapter.getPropertyDefinitions();

    expect(getPrimaryRecordProperty(properties)?.id).toBe("name");
  });
});
