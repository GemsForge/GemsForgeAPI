import { describe, expect, it } from "vitest";
import { previewCsv, previewJson } from "./import";

describe("Table Kit import contracts", () => {
  it("previews CSV rows and reports schema errors", () => {
    const result = previewCsv("name,age\nAlex,42", [{ id: "name" }, { id: "age", parse: (value) => Number(value) }]);
    expect(result.rows).toEqual([{ name: "Alex", age: 42 }]);
    expect(result.errors).toEqual([]);
  });

  it("does not produce rows for malformed JSON", () => {
    const result = previewJson("{bad", (value) => value as { name: string });
    expect(result.rows).toEqual([]);
    expect(result.errors[0]?.message).toMatch(/JSON/);
  });
});
