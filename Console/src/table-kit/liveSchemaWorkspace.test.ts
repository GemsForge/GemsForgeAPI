import { describe, expect, it, vi } from "vitest";
import type { LiveSchemaTable } from "../types";
import { createLiveSchemaProperties } from "./liveSchemaWorkspace";

describe("createLiveSchemaProperties", () => {
  it("connects editable scalar columns to the supplied save handler and protects identity fields", async () => {
    const save = vi.fn(async (_row: unknown, _column: string, _value: string | number | null) => undefined);
    const table = {
      columns: [
        { name: "ID", dataType: "TEXT", nullable: false, primaryKey: true, defaultValue: null },
        { name: "HubID", dataType: "TEXT", nullable: false, primaryKey: false, defaultValue: null },
        { name: "Quantity", dataType: "INTEGER", nullable: false, primaryKey: false, defaultValue: "0" },
        { name: "DueDate", dataType: "TEXT", nullable: true, primaryKey: false, defaultValue: null },
        { name: "Notes", dataType: "TEXT", nullable: true, primaryKey: false, defaultValue: null },
        { name: "Photo", dataType: "BLOB", nullable: true, primaryKey: false, defaultValue: null },
      ],
    } satisfies Pick<LiveSchemaTable, "columns">;
    const record = { id: "goal-1", ID: "goal-1", HubID: "hub-a", Quantity: "3" };
    const properties = createLiveSchemaProperties<typeof record>(table, async (row, column, value) =>
      save(row, column, value),
    );
    const quantity = properties.find((property) => property.id === "Quantity")!;

    expect(quantity.edit?.inputType).toBe("number");
    expect(properties.find((property) => property.id === "DueDate")?.edit?.inputType).toBe("date");
    expect(properties.find((property) => property.id === "Notes")?.edit?.inputType).toBe("text");
    expect(properties.find((property) => property.id === "ID")?.edit).toBeUndefined();
    expect(properties.find((property) => property.id === "HubID")?.edit).toBeUndefined();
    expect(properties.find((property) => property.id === "Photo")?.edit).toBeUndefined();

    await quantity.edit?.onSave(record, 9);
    expect(save).toHaveBeenCalledWith(record, "Quantity", 9);
  });
});
