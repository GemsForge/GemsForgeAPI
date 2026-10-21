import { describe, expect, it } from "vitest";
import { getPrimaryRecordProperty, orderRecordProperties, type RecordAdapter } from "./recordContracts";

interface ExampleRecord {
  id: string;
  name: string;
  status: string;
}

const adapter: RecordAdapter<ExampleRecord> = {
  getId: (record) => record.id,
  getTitle: (record) => record.name,
  getStatus: (record) => ({ label: record.status, tone: "default" }),
  getProperties: () => [
    { id: "status", label: "Status", order: 2, getValue: (record) => ({ display: record.status }) },
    { id: "name", label: "Name", order: 1, primary: true, getValue: (record) => ({ display: record.name }) },
  ],
};

describe("Table Kit record contracts", () => {
  it("preserves adapter-owned record identity and presentation metadata", () => {
    const record = { id: "record-1", name: "Alpha", status: "Active" } satisfies ExampleRecord;

    expect(adapter.getId(record, 0)).toBe("record-1");
    expect(adapter.getTitle?.(record)).toBe("Alpha");
    expect(adapter.getStatus?.(record)).toEqual({ label: "Active", tone: "default" });
  });

  it("orders properties without mutating the adapter definition", () => {
    const properties = adapter.getProperties({ id: "record-1", name: "Alpha", status: "Active" });

    expect(orderRecordProperties(properties).map((property) => property.id)).toEqual(["name", "status"]);
    expect(properties.map((property) => property.id)).toEqual(["status", "name"]);
  });

  it("uses the explicit primary property before the first ordered property", () => {
    const properties = adapter.getProperties({ id: "record-1", name: "Alpha", status: "Active" });

    expect(getPrimaryRecordProperty(properties)?.id).toBe("name");
  });
});
