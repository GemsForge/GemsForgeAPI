import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRecordUtilities } from "./useRecordUtilities";

describe("useRecordUtilities", () => {
  it("sorts the filtered subset in either direction", () => {
    const records = [
      { name: "zeta", status: "Current" },
      { name: "Alpha", status: "Former" },
      { name: "beta", status: "Current" },
    ];
    const hook = renderHook(() => useRecordUtilities(records, (record) => [record.name, record.status], {
      name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    }));

    act(() => hook.result.current.onFilter("current"));
    act(() => hook.result.current.onSort("name"));
    expect(hook.result.current.records.map((record) => record.name)).toEqual(["beta", "zeta"]);

    act(() => hook.result.current.onDirection());
    expect(hook.result.current.records.map((record) => record.name)).toEqual(["zeta", "beta"]);
  });
});
